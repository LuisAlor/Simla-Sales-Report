"""
Fetch and flatten orders from Simla REST v5 /api/v5/orders.
Handles full pagination transparently; callers receive a flat list of dicts.
Pages are fetched in parallel batches for speed.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

from .client import SimlaClient

_PAGE_LIMIT = 100   # max allowed by Simla API
_WORKERS = 10       # concurrent requests


def _fetch_page(client: SimlaClient, params: dict, page: int) -> list[dict]:
    resp = client.get("orders", {**params, "page": page, "limit": _PAGE_LIMIT})
    return resp.get("orders", [])


def fetch_orders(
    client: SimlaClient,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    order_type: str | None = None,
    manager_id: int | None = None,
    progress_callback=None,
) -> list[dict]:
    """Return a flat list of all matching orders (all pages, fetched in parallel).

    progress_callback: optional callable(pages_done, total_pages).
    """
    # Simla v5 requires filter fields under filter[...] bracket notation
    filter_: dict = {}
    if date_from:
        filter_["filter[createdAtFrom]"] = date_from.strftime("%Y-%m-%d 00:00:00")
    if date_to:
        filter_["filter[createdAtTo]"] = date_to.strftime("%Y-%m-%d 23:59:59")
    if status:
        filter_["filter[status]"] = status
    if order_type:
        filter_["filter[orderType]"] = order_type
    if manager_id:
        filter_["filter[managerId]"] = manager_id

    # Page 1 first to learn total_pages
    resp1 = client.get("orders", {**filter_, "page": 1, "limit": _PAGE_LIMIT})
    total_pages = resp1.get("pagination", {}).get("totalPageCount", 1)
    results: dict[int, list[dict]] = {1: resp1.get("orders", [])}

    if progress_callback:
        progress_callback(1, total_pages)

    if total_pages > 1:
        remaining = list(range(2, total_pages + 1))
        done = 1
        with ThreadPoolExecutor(max_workers=_WORKERS) as pool:
            futures = {pool.submit(_fetch_page, client, filter_, p): p for p in remaining}
            for future in as_completed(futures):
                page_num = futures[future]
                results[page_num] = future.result()
                done += 1
                if progress_callback:
                    progress_callback(done, total_pages)

    # Reassemble in page order
    orders: list[dict] = []
    for p in range(1, total_pages + 1):
        orders.extend(results.get(p, []))
    return orders


def _cf(custom_fields: dict, key: str, default=None):
    """Safely read a custom field value."""
    return custom_fields.get(key, default)


def _cf_float(custom_fields: dict, key: str) -> float:
    try:
        return float(custom_fields.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


def _cf_list(custom_fields: dict, key: str) -> list[str]:
    """Return a multi-select custom field as a list of code strings."""
    val = custom_fields.get(key)
    if val is None:
        return []
    if isinstance(val, list):
        # May be list of strings or list of dicts with 'code'
        result = []
        for item in val:
            if isinstance(item, dict):
                result.append(item.get("code", ""))
            else:
                result.append(str(item))
        return [r for r in result if r]
    if isinstance(val, str):
        return [v.strip() for v in val.split(",") if v.strip()]
    return []


def flatten_order(order: dict) -> dict:
    """Extract analytics-relevant scalars from a raw order dict."""
    manager = order.get("manager") or {}
    customer = order.get("customer") or {}
    cf = order.get("customFields") or {}

    popadal = _cf_list(cf, "popadal_v_statusy")

    return {
        "id": order.get("id"),
        "number": order.get("number"),
        "created_at": order.get("createdAt"),
        "status": order.get("status"),
        "order_type": order.get("orderType"),
        # revenue
        "summ": float(order.get("summ") or 0),
        "total_summ": float(order.get("totalSumm") or 0),
        "prepay_sum": float(order.get("prepaySum") or 0),
        "purchase_summ": float(order.get("purchaseSumm") or 0),
        # manager
        "manager_id": manager.get("id") or order.get("managerId"),
        "manager_name": f"{manager.get('firstName', '')} {manager.get('lastName', '')}".strip(),
        # customer
        "customer_id": customer.get("id"),
        "customer_name": f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip(),
        "customer_email": customer.get("email"),
        # derived
        "item_count": len(order.get("items") or []),
        "margin": float(order.get("totalSumm") or 0) - float(order.get("purchaseSumm") or 0),
        # custom fields — qualification
        "cf_num_users":       _cf(cf, "crm_num_of_users_new"),
        "cf_client_base":     _cf(cf, "tamano_de_base_de_clientes"),
        "cf_leads_per_day":   _cf(cf, "leads_por_dia"),
        "cf_sector":          _cf(cf, "sector"),
        "cf_win_probability": _cf(cf, "win_probability"),
        "cf_is_referral":     _cf(cf, "is_client_referral_order"),
        "cf_returning":       _cf(cf, "cliente_retornado"),
        "cf_prev_platform":   _cf(cf, "plataforma_previa"),
        "cf_whatsapp_type":   _cf(cf, "tipo_de_whatsapp"),
        "cf_segment":         _cf(cf, "segment_lida"),
        # custom fields — financial
        "cf_first_payment":   _cf_float(cf, "the_amount_of_the_first_payment"),
        "cf_payment_period":  _cf_float(cf, "payment_first_period_license"),
        "cf_refunded":        _cf_float(cf, "refunded_amount"),
        # funnel history (multi-select list of codes)
        "popadal_v_statusy":  popadal,
    }


def orders_to_records(orders: list[dict]) -> list[dict]:
    """Flatten a list of raw order dicts into analytics-ready records."""
    return [flatten_order(o) for o in orders]


def line_items_to_records(orders: list[dict]) -> list[dict]:
    """Extract line items with their parent order ID for product-level analysis."""
    rows = []
    for order in orders:
        order_id = order.get("id")
        created_at = order.get("createdAt")
        for item in order.get("items") or []:
            rows.append({
                "order_id": order_id,
                "created_at": created_at,
                "product_name": item.get("productName"),
                "quantity": float(item.get("quantity") or 0),
                "unit_price": float(item.get("initialPrice") or 0),
                "discount_percent": float(item.get("discountPercent") or 0),
                "purchase_price": float(item.get("purchasePrice") or 0),
                "revenue": float(item.get("quantity") or 0) * float(item.get("initialPrice") or 0),
            })
    return rows
