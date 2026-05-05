"""Этапы воронки — funnel analytics page."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from src.dashboard.charts import funnel_bar_horizontal, funnel_lines, platforms_donut
from src.utils.mappings import (
    FUNNEL_KEY_STAGES,
    FUNNEL_NEGATIVE_STAGES,
    FUNNEL_POSTSALES_STAGES,
)
from src.utils.transforms import (
    financial_kpis,
    funnel_over_time,
    funnel_stage_counts,
    platforms_breakdown,
    to_orders_df,
)


def _dark_kpi(label: str, value: str, color: str) -> str:
    return f"""
    <div style="background:#252A45;border-radius:10px;padding:1.2rem 1rem;text-align:center;
                border:1px solid #2D3452;min-width:120px">
        <div style="color:#94A3B8;font-size:0.72rem;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem">
            {label}
        </div>
        <div style="color:{color};font-size:1.8rem;font-weight:800;line-height:1.1">
            {value}
        </div>
    </div>"""


def render(df: pd.DataFrame, freq: str = "D") -> None:
    """Render the full Этапы воронки dashboard."""

    if df.empty:
        st.warning("Sin datos para mostrar.")
        return

    # ── Registration summary KPIs ────────────────────────────────────────────
    total_regs    = len(df)
    returning     = int(df["cf_returning"].notna().sum() and
                        (df["cf_returning"] != "no").sum())
    recommended   = int((df["cf_is_referral"] == "si").sum())

    st.markdown("### Кол-во регистраций CRM")
    cols = st.columns(4)
    cols[0].metric("Total registros",   f"{total_regs:,}")
    cols[1].metric("Hecho de registro", f"{total_regs:,}")
    cols[2].metric("♻️ Retornados",     f"{returning:,}")
    cols[3].metric("👍 Recomendados",   f"{recommended:,}")

    st.divider()

    # ── Financial KPIs ───────────────────────────────────────────────────────
    fk = financial_kpis(df)
    st.markdown("### Общие показатели продаж")
    kpi_html = "".join([
        _dark_kpi("Total Sales (#)", f"{fk['total_sales']:,}",          "#F59E0B"),
        _dark_kpi("MRR",             f"${fk['mrr']:,.0f}",              "#F59E0B"),
        _dark_kpi("SARPU",           f"${fk['sarpu']:,.0f}",            "#60A5FA"),
        _dark_kpi("Total Refunded",  f"${fk['refunded']:,.0f}",         "#F87171"),
        _dark_kpi("Net Total",       f"${fk['net_total']:,.0f}",        "#86EFAC"),
    ])
    st.markdown(
        f"<div style='display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem'>{kpi_html}</div>",
        unsafe_allow_html=True,
    )

    st.divider()

    # ── Key funnel stages ────────────────────────────────────────────────────
    st.markdown("### Ключевые этапы воронки")
    key_df = funnel_stage_counts(df, FUNNEL_KEY_STAGES)
    key_ts = funnel_over_time(df, FUNNEL_KEY_STAGES, freq=freq)

    col_tbl, col_chart = st.columns([1, 2])
    with col_tbl:
        st.dataframe(
            key_df[["label", "count", "cr_pct"]].rename(
                columns={"label": "Etapa", "count": "Total", "cr_pct": "CR (%)"}
            ),
            hide_index=True,
            use_container_width=True,
        )
    with col_chart:
        if not key_ts.empty:
            st.plotly_chart(funnel_lines(key_ts), use_container_width=True)

    st.plotly_chart(
        funnel_bar_horizontal(key_df, "Ключевые этапы воронки"),
        use_container_width=True,
    )

    st.divider()

    # ── Negative funnel stages ───────────────────────────────────────────────
    st.markdown("### Негативные этапы воронки")
    neg_df = funnel_stage_counts(df, FUNNEL_NEGATIVE_STAGES)
    neg_ts = funnel_over_time(df, FUNNEL_NEGATIVE_STAGES, freq=freq)

    col_tbl, col_chart = st.columns([1, 2])
    with col_tbl:
        st.dataframe(
            neg_df[["label", "count", "cr_pct"]].rename(
                columns={"label": "Etapa", "count": "Total", "cr_pct": "CR (%)"}
            ),
            hide_index=True,
            use_container_width=True,
        )
    with col_chart:
        if not neg_ts.empty:
            st.plotly_chart(funnel_lines(neg_ts), use_container_width=True)

    st.plotly_chart(
        funnel_bar_horizontal(neg_df, "Негативные этапы воронки"),
        use_container_width=True,
    )

    st.divider()

    # ── Post-sales funnel stages ─────────────────────────────────────────────
    st.markdown("### Постпродажные этапы воронки")
    ps_df = funnel_stage_counts(df, FUNNEL_POSTSALES_STAGES)
    ps_ts = funnel_over_time(df, FUNNEL_POSTSALES_STAGES, freq=freq)

    col_tbl, col_chart = st.columns([1, 2])
    with col_tbl:
        st.dataframe(
            ps_df[["label", "count", "cr_pct"]].rename(
                columns={"label": "Etapa", "count": "Total", "cr_pct": "CR (%)"}
            ),
            hide_index=True,
            use_container_width=True,
        )
    with col_chart:
        if not ps_ts.empty:
            st.plotly_chart(funnel_lines(ps_ts), use_container_width=True)

    st.plotly_chart(
        funnel_bar_horizontal(ps_df, "Постпродажные этапы воронки"),
        use_container_width=True,
    )

    st.divider()

    # ── Previous platforms donut ─────────────────────────────────────────────
    st.markdown("### Источники лидов по платформам")
    plat_df = platforms_breakdown(df)
    if not plat_df.empty:
        st.plotly_chart(platforms_donut(plat_df), use_container_width=True)
    else:
        st.info("Sin datos de plataforma previa.")
