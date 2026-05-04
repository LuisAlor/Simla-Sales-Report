"""Plotly chart builders — Simla color palette."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

_TEAL       = "#00BCD4"
_TEAL_LIGHT = "#4DD0E1"
_BLUE       = "#2563EB"
_NAVY       = "#1E2238"
_GRAY       = "#94A3B8"

_PALETTE = [_TEAL, _BLUE, "#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#6366F1", _GRAY]

_LAYOUT = dict(
    plot_bgcolor="white",
    paper_bgcolor="white",
    font=dict(family="sans-serif", color="#1E293B"),
    title_font=dict(size=15, color="#1E293B"),
    margin=dict(t=48, b=32, l=16, r=16),
    legend=dict(bgcolor="rgba(0,0,0,0)"),
)


def revenue_line(ts: pd.DataFrame) -> go.Figure:
    fig = px.line(
        ts, x="date", y="revenue",
        title="Ingresos en el tiempo",
        labels={"revenue": "Ingresos", "date": "Fecha"},
    )
    fig.update_traces(line_color=_TEAL, line_width=2.5, fill="tozeroy",
                      fillcolor="rgba(0,188,212,0.08)")
    fig.update_layout(hovermode="x unified", **_LAYOUT)
    fig.update_yaxes(gridcolor="#F1F5F9", zeroline=False)
    fig.update_xaxes(showgrid=False)
    return fig


def orders_count_bar(ts: pd.DataFrame) -> go.Figure:
    fig = px.bar(
        ts, x="date", y="orders",
        title="Pedidos en el tiempo",
        labels={"orders": "Pedidos", "date": "Fecha"},
        color_discrete_sequence=[_TEAL],
    )
    fig.update_layout(**_LAYOUT)
    fig.update_yaxes(gridcolor="#F1F5F9", zeroline=False)
    fig.update_xaxes(showgrid=False)
    return fig


def status_pie(status_df: pd.DataFrame) -> go.Figure:
    fig = px.pie(
        status_df, names="status", values="orders",
        title="Pedidos por estado",
        hole=0.45,
        color_discrete_sequence=_PALETTE,
    )
    fig.update_traces(textposition="inside", textinfo="percent+label")
    fig.update_layout(**_LAYOUT)
    return fig


def manager_bar(manager_df: pd.DataFrame) -> go.Figure:
    fig = px.bar(
        manager_df, x="manager_name", y="revenue",
        text="orders",
        title="Ingresos por asesor",
        labels={"manager_name": "Asesor", "revenue": "Ingresos"},
        color_discrete_sequence=[_TEAL],
    )
    fig.update_traces(texttemplate="%{text} pedidos", textposition="outside")
    fig.update_layout(**_LAYOUT)
    fig.update_yaxes(gridcolor="#F1F5F9", zeroline=False)
    fig.update_xaxes(showgrid=False)
    return fig


def top_products_bar(products_df: pd.DataFrame) -> go.Figure:
    fig = px.bar(
        products_df.sort_values("revenue"),
        x="revenue", y="product_name",
        orientation="h",
        title="Productos principales por ingresos",
        labels={"product_name": "Producto", "revenue": "Ingresos"},
        color_discrete_sequence=[_TEAL],
    )
    fig.update_layout(**_LAYOUT)
    fig.update_xaxes(gridcolor="#F1F5F9", zeroline=False)
    fig.update_yaxes(showgrid=False)
    return fig
