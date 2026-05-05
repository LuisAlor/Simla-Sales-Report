"""Pandas-based aggregation helpers for the analytics dashboard."""
from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    pass


def to_orders_df(records: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["date"] = df["created_at"].dt.date
    return df


def revenue_over_time(df: pd.DataFrame, freq: str = "D") -> pd.DataFrame:
    """Resample orders to revenue time series. freq: 'D', 'W', 'ME'."""
    if df.empty:
        return pd.DataFrame(columns=["date", "revenue", "orders"])
    ts = (
        df.set_index("created_at")
        .resample(freq)
        .agg(revenue=("total_summ", "sum"), orders=("id", "count"))
        .reset_index()
        .rename(columns={"created_at": "date"})
    )
    return ts


def orders_by_status(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["status", "orders", "revenue"])
    return (
        df.groupby("status", dropna=False)
        .agg(orders=("id", "count"), revenue=("total_summ", "sum"))
        .reset_index()
        .sort_values("orders", ascending=False)
    )


def orders_by_manager(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["manager_name", "orders", "revenue", "avg_order"])
    grp = (
        df.groupby("manager_name", dropna=False)
        .agg(orders=("id", "count"), revenue=("total_summ", "sum"))
        .reset_index()
    )
    grp["avg_order"] = grp["revenue"] / grp["orders"].replace(0, pd.NA)
    return grp.sort_values("revenue", ascending=False)


def top_products(items_df: pd.DataFrame, n: int = 15) -> pd.DataFrame:
    if items_df.empty:
        return pd.DataFrame(columns=["product_name", "quantity", "revenue"])
    return (
        items_df.groupby("product_name", dropna=False)
        .agg(quantity=("quantity", "sum"), revenue=("revenue", "sum"))
        .reset_index()
        .sort_values("revenue", ascending=False)
        .head(n)
    )


def repeat_customers(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["customer_id", "customer_name", "orders", "revenue"])
    grp = (
        df.groupby(["customer_id", "customer_name"], dropna=False)
        .agg(orders=("id", "count"), revenue=("total_summ", "sum"))
        .reset_index()
    )
    return grp[grp["orders"] > 1].sort_values("orders", ascending=False)


# ---------------------------------------------------------------------------
# Funnel helpers
# ---------------------------------------------------------------------------

def _has_stage(popadal_series: pd.Series, code: str) -> pd.Series:
    """Boolean mask: True where the popadal list contains `code`."""
    return popadal_series.apply(lambda lst: code in lst if isinstance(lst, list) else False)


def funnel_stage_counts(
    df: pd.DataFrame,
    stages: list[tuple[str, str]],
) -> pd.DataFrame:
    """Count orders that passed through each stage (via popadal_v_statusy).

    stages: list of (status_code, popadal_code) tuples
    Returns DataFrame with columns: status_code, label, count, cr_pct
    """
    from src.utils.mappings import STATUS_LABELS
    if df.empty or "popadal_v_statusy" not in df.columns:
        return pd.DataFrame(columns=["status_code", "label", "count", "cr_pct"])

    base = len(df)
    rows = []
    for status_code, popadal_code in stages:
        cnt = int(_has_stage(df["popadal_v_statusy"], popadal_code).sum())
        rows.append({
            "status_code": status_code,
            "label": STATUS_LABELS.get(status_code, status_code),
            "count": cnt,
            "cr_pct": round(cnt / base * 100, 1) if base else 0.0,
        })
    return pd.DataFrame(rows)


def funnel_over_time(
    df: pd.DataFrame,
    stages: list[tuple[str, str]],
    freq: str = "D",
) -> pd.DataFrame:
    """Multi-line time series: for each period bucket, count orders per stage.

    Returns a wide DataFrame with one column per stage label + a 'date' column.
    """
    from src.utils.mappings import STATUS_LABELS
    if df.empty or "popadal_v_statusy" not in df.columns:
        return pd.DataFrame()

    ts = df.set_index("created_at").resample(freq)

    result = pd.DataFrame(index=ts.groups.keys())
    result.index.name = "date"

    for status_code, popadal_code in stages:
        label = STATUS_LABELS.get(status_code, status_code)
        mask = _has_stage(df["popadal_v_statusy"], popadal_code)
        col = df[mask].set_index("created_at").resample(freq).size().rename(label)
        result = result.join(col, how="left")

    result = result.fillna(0).astype(int).reset_index()
    return result


def financial_kpis(df: pd.DataFrame) -> dict:
    """Compute Total Sales, MRR, SARPU, Total Refunded, Net Total."""
    from src.utils.mappings import PAID_STATUS_CODE, REFUND_STATUS_CODE

    if df.empty or "popadal_v_statusy" not in df.columns:
        return {"total_sales": 0, "mrr": 0.0, "sarpu": 0.0, "refunded": 0.0, "net_total": 0.0}

    paid_mask   = _has_stage(df["popadal_v_statusy"], PAID_STATUS_CODE)
    refund_mask = _has_stage(df["popadal_v_statusy"], REFUND_STATUS_CODE)

    paid_df   = df[paid_mask]
    refund_df = df[refund_mask]

    total_sales = int(paid_mask.sum())
    sarpu       = float(paid_df["cf_first_payment"].sum())

    periods = paid_df["cf_payment_period"].replace(0, pd.NA)
    mrr     = float((paid_df["cf_first_payment"] / periods).sum())

    refunded  = float(refund_df["cf_refunded"].sum())
    net_total = sarpu - refunded

    return {
        "total_sales": total_sales,
        "mrr":         mrr,
        "sarpu":       sarpu,
        "refunded":    refunded,
        "net_total":   net_total,
    }


def platforms_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """Count orders by previous platform (cf_prev_platform)."""
    if df.empty or "cf_prev_platform" not in df.columns:
        return pd.DataFrame(columns=["platform", "count"])
    return (
        df.groupby("cf_prev_platform", dropna=False)
        .size()
        .reset_index(name="count")
        .rename(columns={"cf_prev_platform": "platform"})
        .sort_values("count", ascending=False)
    )
