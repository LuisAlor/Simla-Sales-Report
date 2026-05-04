"""Pandas-based aggregation helpers for the analytics dashboard."""
from __future__ import annotations

import pandas as pd


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
