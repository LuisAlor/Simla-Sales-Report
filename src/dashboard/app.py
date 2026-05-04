"""
Simla CRM Analytics Dashboard
Run with: streamlit run src/dashboard/app.py
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import streamlit as st

from src.api.client import SimlaClient
from src.api.orders import fetch_orders, line_items_to_records, orders_to_records
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

st.set_page_config(
    page_title="Simla CRM Analytics",
    page_icon="📊",
    layout="wide",
)


# ------------------------------------------------------------------
# Sidebar — credentials + filters
# ------------------------------------------------------------------

with st.sidebar:
    st.title("⚙️ Configuration")

    store = st.text_input("Store subdomain", placeholder="mystore")
    api_key = st.text_input("API Key", type="password")

    st.divider()
    st.subheader("Filters")

    col1, col2 = st.columns(2)
    with col1:
        date_from = st.date_input("From", value=date.today() - timedelta(days=30))
    with col2:
        date_to = st.date_input("To", value=date.today())

    freq_map = {"Daily": "D", "Weekly": "W", "Monthly": "ME"}
    freq_label = st.selectbox("Time granularity", list(freq_map))
    freq = freq_map[freq_label]

    status_filter = st.text_input("Status (optional)", placeholder="e.g. new")
    manager_filter = st.text_input("Manager ID (optional)", placeholder="e.g. 42")

    load = st.button("Load data", type="primary", use_container_width=True)

# ------------------------------------------------------------------
# Main area
# ------------------------------------------------------------------

st.title("📊 Simla CRM Analytics Dashboard")

if not load:
    st.info("Enter your store credentials in the sidebar and click **Load data**.")
    st.stop()

if not store or not api_key:
    st.error("Store subdomain and API Key are required.")
    st.stop()

with st.spinner("Fetching orders from Simla…"):
    try:
        client = SimlaClient(store=store, api_key=api_key)
        raw_orders = fetch_orders(
            client,
            date_from=date_from,
            date_to=date_to,
            status=status_filter or None,
            manager_id=int(manager_filter) if manager_filter.strip() else None,
        )
    except Exception as exc:
        st.error(f"API error: {exc}")
        st.stop()

if not raw_orders:
    st.warning("No orders found for the selected filters.")
    st.stop()

records = orders_to_records(raw_orders)
items_records = line_items_to_records(raw_orders)
df = to_orders_df(records)
items_df = pd.DataFrame(items_records)
if not items_df.empty:
    items_df["created_at"] = pd.to_datetime(items_df["created_at"])

# ------------------------------------------------------------------
# KPI tiles
# ------------------------------------------------------------------

total_revenue = df["total_summ"].sum()
total_orders = len(df)
avg_order = total_revenue / total_orders if total_orders else 0
total_margin = df["margin"].sum()
margin_pct = (total_margin / total_revenue * 100) if total_revenue else 0

k1, k2, k3, k4 = st.columns(4)
k1.metric("Total Revenue", f"${total_revenue:,.2f}")
k2.metric("Total Orders", f"{total_orders:,}")
k3.metric("Avg Order Value", f"${avg_order:,.2f}")
k4.metric("Gross Margin", f"${total_margin:,.2f}", delta=f"{margin_pct:.1f}%")

st.divider()

# ------------------------------------------------------------------
# Revenue & orders over time
# ------------------------------------------------------------------

ts = revenue_over_time(df, freq=freq)

col_left, col_right = st.columns(2)
with col_left:
    st.plotly_chart(revenue_line(ts), use_container_width=True)
with col_right:
    st.plotly_chart(orders_count_bar(ts), use_container_width=True)

# ------------------------------------------------------------------
# Status breakdown & manager performance
# ------------------------------------------------------------------

col_left, col_right = st.columns(2)
with col_left:
    st.plotly_chart(status_pie(orders_by_status(df)), use_container_width=True)
with col_right:
    mgr_df = orders_by_manager(df)
    st.plotly_chart(manager_bar(mgr_df), use_container_width=True)

# ------------------------------------------------------------------
# Top products
# ------------------------------------------------------------------

if not items_df.empty:
    prod_df = top_products(items_df)
    st.plotly_chart(top_products_bar(prod_df), use_container_width=True)

# ------------------------------------------------------------------
# Repeat customers
# ------------------------------------------------------------------

with st.expander("Repeat customers"):
    rc = repeat_customers(df)
    if rc.empty:
        st.info("No repeat customers in this period.")
    else:
        st.dataframe(rc, use_container_width=True)

# ------------------------------------------------------------------
# Raw data
# ------------------------------------------------------------------

with st.expander("Raw orders table"):
    st.dataframe(df, use_container_width=True)

with st.expander("Manager breakdown table"):
    st.dataframe(mgr_df, use_container_width=True)
