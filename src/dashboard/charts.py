"""Plotly chart builders for the analytics dashboard."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def revenue_line(ts: pd.DataFrame) -> go.Figure:
    fig = px.line(
        ts,
        x="date",
        y="revenue",
        title="Revenue over time",
        labels={"revenue": "Revenue", "date": "Date"},
    )
    fig.update_traces(line_color="#2563EB", line_width=2)
    fig.update_layout(hovermode="x unified")
    return fig


def orders_count_bar(ts: pd.DataFrame) -> go.Figure:
    return px.bar(
        ts,
        x="date",
        y="orders",
        title="Orders over time",
        labels={"orders": "Order count", "date": "Date"},
        color_discrete_sequence=["#7C3AED"],
    )


def status_pie(status_df: pd.DataFrame) -> go.Figure:
    return px.pie(
        status_df,
        names="status",
        values="orders",
        title="Orders by status",
        hole=0.4,
    )


def manager_bar(manager_df: pd.DataFrame) -> go.Figure:
    return px.bar(
        manager_df,
        x="manager_name",
        y="revenue",
        text="orders",
        title="Revenue by manager",
        labels={"manager_name": "Manager", "revenue": "Revenue"},
        color_discrete_sequence=["#059669"],
    )


def top_products_bar(products_df: pd.DataFrame) -> go.Figure:
    return px.bar(
        products_df.sort_values("revenue"),
        x="revenue",
        y="product_name",
        orientation="h",
        title="Top products by revenue",
        labels={"product_name": "Product", "revenue": "Revenue"},
        color_discrete_sequence=["#DC2626"],
    )
