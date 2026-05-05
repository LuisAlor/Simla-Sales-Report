"""
Simla CRM Analytics Dashboard
Run with: streamlit run src/dashboard/app.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from datetime import date, timedelta

import pandas as pd
import streamlit as st

from src.api.client import SimlaClient
from src.api.orders import fetch_orders, line_items_to_records, orders_to_records
from src.dashboard import funnel as funnel_page
from src.dashboard.charts import (
    manager_bar,
    orders_count_bar,
    revenue_line,
    status_pie,
    top_products_bar,
)
from src.utils.transforms import (
    orders_by_manager,
    orders_by_status,
    repeat_customers,
    revenue_over_time,
    to_orders_df,
    top_products,
)

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="Simla Analíticas",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# CSS — dark sidebar matching Simla CRM style
# ---------------------------------------------------------------------------

st.markdown("""
<style>
/* ── Sidebar background ── */
[data-testid="stSidebar"] {
    background-color: #1E2238 !important;
    border-right: none !important;
}
[data-testid="stSidebar"] > div:first-child {
    padding-top: 1rem;
}

/* ── Sidebar text ── */
[data-testid="stSidebar"] label,
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] span,
[data-testid="stSidebar"] div {
    color: #CBD5E1 !important;
}
[data-testid="stSidebar"] h1,
[data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3 {
    color: #FFFFFF !important;
}

/* ── Sidebar inputs ── */
[data-testid="stSidebar"] input,
[data-testid="stSidebar"] .stSelectbox > div > div {
    background-color: #2D3452 !important;
    color: #FFFFFF !important;
    border-color: #3D4568 !important;
    border-radius: 6px !important;
}
[data-testid="stSidebar"] .stDateInput input {
    background-color: #2D3452 !important;
    color: #FFFFFF !important;
}

/* ── Sidebar button ── */
[data-testid="stSidebar"] .stButton > button {
    background-color: #2563EB !important;
    color: #FFFFFF !important;
    border: none !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
    width: 100% !important;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background-color: #1D4ED8 !important;
}

/* ── Sidebar divider ── */
[data-testid="stSidebar"] hr {
    border-color: #2D3452 !important;
}

/* ── Logo / brand area ── */
.brand-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 0 1.2rem 0;
    border-bottom: 1px solid #2D3452;
    margin-bottom: 1.2rem;
}
.brand-title {
    color: #FFFFFF;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.02em;
}
.brand-sub {
    color: #64748B;
    font-size: 0.72rem;
    margin-top: 1px;
}

/* ── Nav section labels ── */
.nav-section {
    color: #64748B !important;
    font-size: 0.68rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
    padding: 0.8rem 0 0.3rem 0 !important;
}

/* ── KPI metric cards ── */
[data-testid="stMetric"] {
    background-color: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 1rem 1.25rem !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
[data-testid="stMetricLabel"] {
    color: #64748B !important;
    font-size: 0.78rem !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
}
[data-testid="stMetricValue"] {
    color: #1E293B !important;
    font-size: 1.6rem !important;
    font-weight: 700 !important;
}
[data-testid="stMetricDelta"] {
    font-size: 0.82rem !important;
}

/* ── Chart containers ── */
[data-testid="stPlotlyChart"] {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* ── Section headers ── */
.section-header {
    color: #1E293B;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1.2rem 0 0.6rem 0;
    border-bottom: 2px solid #00BCD4;
    margin-bottom: 0.8rem;
    display: inline-block;
}

/* ── Main content top padding ── */
.main .block-container {
    padding-top: 1.5rem !important;
}

/* ── Expander ── */
.streamlit-expanderHeader {
    background-color: #F8FAFC !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    color: #1E293B !important;
}
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Sidebar — brand + credentials + filters
# ---------------------------------------------------------------------------

with st.sidebar:
    # Logo + brand
    _logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "logo.png")
    if os.path.exists(_logo_path):
        col_logo, col_brand = st.columns([1, 3])
        with col_logo:
            st.image(_logo_path, width=48)
        with col_brand:
            st.markdown("""
            <div style='padding-top:6px'>
                <div class='brand-title'>Simla Analíticas</div>
                <div class='brand-sub'>Panel de ventas · CRM License</div>
            </div>""", unsafe_allow_html=True)
    else:
        st.markdown("""
        <div class="brand-header">
            <div>
                <div class="brand-title">📊 Simla Analíticas</div>
                <div class="brand-sub">Panel de ventas · CRM License</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<div class="nav-section">Navegación</div>', unsafe_allow_html=True)
    page = st.radio(
        "page",
        ["📊 Analíticas generales", "🔻 Этапы воронки"],
        label_visibility="collapsed",
    )

    st.divider()
    st.markdown('<div class="nav-section">Configuración</div>', unsafe_allow_html=True)
    api_key = st.text_input("API Key", type="password", placeholder="Ingresa tu API Key")

    # Fetch order types as soon as an API key is present
    if api_key:
        if st.session_state.get("_last_api_key") != api_key:
            try:
                _client = SimlaClient(store="base", api_key=api_key)
                _raw_types = _client.get_order_types()
                st.session_state["order_type_options"] = {
                    t.get("name", t.get("code", "")): t.get("code", "")
                    for t in _raw_types
                }
                st.session_state["_last_api_key"] = api_key
            except Exception:
                st.session_state["order_type_options"] = {}

    st.divider()
    st.markdown('<div class="nav-section">Filtros</div>', unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        date_from = st.date_input("Desde", value=date.today() - timedelta(days=30))
    with col2:
        date_to = st.date_input("Hasta", value=date.today())

    freq_map = {"Diario": "D", "Semanal": "W", "Mensual": "ME"}
    freq_label = st.selectbox("Granularidad", list(freq_map))
    freq = freq_map[freq_label]

    # Order type multiselect
    type_options = st.session_state.get("order_type_options", {})
    if type_options:
        default_names = [n for n, c in type_options.items() if c == "crm-license"]
        selected_names = st.multiselect(
            "Tipo de pedido",
            options=list(type_options.keys()),
            default=default_names,
        )
        selected_types = [type_options[n] for n in selected_names]
    else:
        st.caption("Introduce tu API Key para cargar los tipos de pedido.")
        selected_types = ["crm-license"]

    manager_filter = st.text_input("ID de asesor (opcional)", placeholder="ej. 42")

    st.divider()
    load = st.button("Cargar datos", type="primary", use_container_width=True)

# ---------------------------------------------------------------------------
# Main content
# ---------------------------------------------------------------------------

_page_title = "Этапы воронки" if "воронки" in page else "Analíticas · Pedidos"
st.markdown(f"<h2 style='color:#1E293B;margin-bottom:0'>{_page_title}</h2>", unsafe_allow_html=True)
st.caption("Estadísticas de todas las tiendas · Datos de pedidos recibidos · crm-license")

if not load:
    st.info("Introduce tu API Key en el panel lateral y pulsa **Cargar datos**.")
    st.stop()

if not api_key:
    st.error("La API Key es obligatoria.")
    st.stop()

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

progress_bar = st.progress(0, text="Iniciando…")

try:
    client = SimlaClient(store="base", api_key=api_key)
    raw_orders: list[dict] = []

    types_to_fetch = selected_types if selected_types else [None]
    for idx, otype in enumerate(types_to_fetch):
        label = otype or "todos"

        def on_progress(current: int, total: int, _label: str = label, _idx: int = idx, _total_types: int = len(types_to_fetch)) -> None:
            pct = int(current / max(total, 1) * 100)
            progress_bar.progress(
                int((_idx * 100 + pct) / _total_types),
                text=f"[{_label}] Página {current} de {total} ({pct}%)…",
            )

        raw_orders += fetch_orders(
            client,
            date_from=date_from,
            date_to=date_to,
            order_type=otype,
            manager_id=int(manager_filter) if manager_filter.strip() else None,
            progress_callback=on_progress,
        )

    progress_bar.empty()
except Exception as exc:
    progress_bar.empty()
    st.error(f"Error de API: {exc}")
    st.stop()

if not raw_orders:
    st.warning("No se encontraron pedidos para los filtros seleccionados.")
    st.stop()

records = orders_to_records(raw_orders)
items_records = line_items_to_records(raw_orders)
df = to_orders_df(records)
items_df = pd.DataFrame(items_records)
if not items_df.empty:
    items_df["created_at"] = pd.to_datetime(items_df["created_at"])

# ---------------------------------------------------------------------------
# Route to funnel page
# ---------------------------------------------------------------------------

if "воронки" in page:
    funnel_page.render(df, freq=freq)
    st.stop()

# ---------------------------------------------------------------------------
# KPI tiles
# ---------------------------------------------------------------------------

total_revenue  = df["total_summ"].sum()
total_orders   = len(df)
avg_order      = total_revenue / total_orders if total_orders else 0
total_margin   = df["margin"].sum()
margin_pct     = (total_margin / total_revenue * 100) if total_revenue else 0

st.markdown('<div class="section-header">Resumen</div>', unsafe_allow_html=True)

k1, k2, k3, k4 = st.columns(4)
k1.metric("Ingresos totales",   f"${total_revenue:,.2f}")
k2.metric("Total pedidos",      f"{total_orders:,}")
k3.metric("Ticket promedio",    f"${avg_order:,.2f}")
k4.metric("Margen bruto",       f"${total_margin:,.2f}", delta=f"{margin_pct:.1f}%")

st.divider()

# ---------------------------------------------------------------------------
# Revenue & orders over time
# ---------------------------------------------------------------------------

st.markdown('<div class="section-header">Evolución temporal</div>', unsafe_allow_html=True)

ts = revenue_over_time(df, freq=freq)
col_l, col_r = st.columns(2)
with col_l:
    st.plotly_chart(revenue_line(ts), use_container_width=True)
with col_r:
    st.plotly_chart(orders_count_bar(ts), use_container_width=True)

# ---------------------------------------------------------------------------
# Status & manager
# ---------------------------------------------------------------------------

st.markdown('<div class="section-header">Distribución</div>', unsafe_allow_html=True)

col_l, col_r = st.columns(2)
with col_l:
    st.plotly_chart(status_pie(orders_by_status(df)), use_container_width=True)
with col_r:
    mgr_df = orders_by_manager(df)
    st.plotly_chart(manager_bar(mgr_df), use_container_width=True)

# ---------------------------------------------------------------------------
# Top products
# ---------------------------------------------------------------------------

if not items_df.empty:
    st.markdown('<div class="section-header">Productos</div>', unsafe_allow_html=True)
    prod_df = top_products(items_df)
    st.plotly_chart(top_products_bar(prod_df), use_container_width=True)

# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

st.markdown('<div class="section-header">Detalle</div>', unsafe_allow_html=True)

with st.expander("Clientes recurrentes"):
    rc = repeat_customers(df)
    if rc.empty:
        st.info("Sin clientes recurrentes en este período.")
    else:
        st.dataframe(rc, use_container_width=True)

with st.expander("Tabla de pedidos"):
    st.dataframe(df, use_container_width=True)

with st.expander("Desglose por asesor"):
    st.dataframe(mgr_df, use_container_width=True)
