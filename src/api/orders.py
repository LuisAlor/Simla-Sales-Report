"""
Fetch and flatten orders from Simla REST v5 /api/v5/orders.
Handles full pagination transparently; callers receive a flat list of dicts.
"""
from __future__ import annotations

from datetime import date
from typing import Iterator

from .client import SimlaClient

_PAGE_LIMIT = 100  # max allowed by Simla API


def _iter_pages(
    client: SimlaClient,
    params: dict,
) -> Iterator[list[dict]]:
    """Yield one page of raw order dicts at a time."""
    page = 1
    while True:
        resp = client.get("orders", {**params, "page": page, "limit": _PAGE_LIMIT})
        orders = resp.get("orders", [])
        yield orders

        total_pages = resp.get("pagination", {}).get("totalPageCount", 1)
        if page >= total_pages or not orders:
            break
        page += 1


def fetch_orders(
    client: SimlaClient,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    order_type: str | None = None,
    manager_id: int | None = None,
) -> list[dict]:
    """Return a flat list of all matching orders (all pages)."""
    params: dict = {}
    if date_from:
        params["createdAtFrom"] = date_from.strftime("%Y-%m-%d 00:00:00")
    if date_to:
        params["createdAtTo"] = date_to.strftime("%Y-%m-%d 23:59:59")
    if status:
        params["status"] = status
    if order_type:
        params["orderType"] = order_type
    if manager_id:
        params["managerId"] = manager_id

    orders: list[dict] = []
    for page in _iter_pages(client, params):
        orders.extend(page)
    return orders


def flatten_order(order: dict) -> dict:
    """
    Extract analytics-relevant scalars from a raw order dict.
    Returns a flat dict suitable for a pandas DataFrame row.
    """
    manager = order.get("manager") or {}
    customer = order.get("customer") or {}
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
