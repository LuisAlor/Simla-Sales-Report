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


# ---------------------------------------------------------------------------
# Funnel charts
# ---------------------------------------------------------------------------

# Distinct colours for up to 10 funnel stage lines (matches screenshot palette)
_FUNNEL_COLORS = [
    "#4FC3F7", "#EF5350", "#66BB6A", "#FF7043", "#AB47BC",
    "#FFA726", "#26C6DA", "#EC407A", "#8D6E63", "#29B6F6",
]

_DARK_LAYOUT = dict(
    plot_bgcolor="#1E2238",
    paper_bgcolor="#1E2238",
    font=dict(family="sans-serif", color="#CBD5E1"),
    title_font=dict(size=15, color="#FFFFFF"),
    margin=dict(t=48, b=32, l=16, r=16),
    legend=dict(
        bgcolor="rgba(0,0,0,0)",
        font=dict(color="#CBD5E1", size=11),
        orientation="h",
        yanchor="top",
        y=-0.2,
        xanchor="left",
        x=0,
    ),
)


def funnel_lines(ts: pd.DataFrame) -> go.Figure:
    """Multi-line chart: one line per funnel stage over time."""
    fig = go.Figure()
    stage_cols = [c for c in ts.columns if c != "date"]
    for i, col in enumerate(stage_cols):
        fig.add_trace(go.Scatter(
            x=ts["date"],
            y=ts[col],
            name=col,
            mode="lines",
            line=dict(color=_FUNNEL_COLORS[i % len(_FUNNEL_COLORS)], width=2),
            hovertemplate=f"<b>{col}</b><br>%{{x|%d.%m.%y}}: %{{y}}<extra></extra>",
        ))
    fig.update_layout(
        title="Отчет по ключевым этапам воронки",
        xaxis=dict(showgrid=False, color="#94A3B8"),
        yaxis=dict(
            gridcolor="#2D3452",
            zeroline=False,
            color="#94A3B8",
            title="Общее кол-во",
        ),
        hovermode="x unified",
        **_DARK_LAYOUT,
    )
    return fig


def funnel_bar_horizontal(stage_df: pd.DataFrame, title: str) -> go.Figure:
    """Horizontal bar chart for a funnel stage group."""
    fig = go.Figure(go.Bar(
        x=stage_df["count"],
        y=stage_df["label"],
        orientation="h",
        text=stage_df["count"],
        textposition="outside",
        marker_color=_TEAL,
        hovertemplate="<b>%{y}</b><br>%{x} pedidos<extra></extra>",
    ))
    fig.update_layout(
        title=title,
        xaxis=dict(showgrid=False, color="#94A3B8"),
        yaxis=dict(autorange="reversed", color="#CBD5E1"),
        **_DARK_LAYOUT,
    )
    return fig


def platforms_donut(plat_df: pd.DataFrame) -> go.Figure:
    """Donut chart for previous platform distribution."""
    total = int(plat_df["count"].sum())
    fig = go.Figure(go.Pie(
        labels=plat_df["platform"],
        values=plat_df["count"],
        hole=0.55,
        textinfo="percent",
        textposition="inside",
        insidetextorientation="radial",
    ))
    fig.update_layout(
        title="Источники лидов по платформам",
        annotations=[dict(
            text=f"<b>{total:,}</b><br><span style='font-size:11px'>registros</span>",
            x=0.5, y=0.5, showarrow=False,
            font=dict(size=18, color="#FFFFFF"),
        )],
        **_DARK_LAYOUT,
    )
    return fig
