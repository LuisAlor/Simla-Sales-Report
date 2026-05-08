// ── Sections ──────────────────────────────────────────────────────────────────
export const SECTION_IDS = ["summary", "temporal", "distribution", "products", "detail"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// ── KPI cards ─────────────────────────────────────────────────────────────────
export const KPI_IDS = ["kpi_revenue", "kpi_orders", "kpi_avg_ticket", "kpi_margin"] as const;
export type KpiId = (typeof KPI_IDS)[number];

// ── Charts ────────────────────────────────────────────────────────────────────
export const CHART_IDS = [
  "revenue_time", "orders_time",
  "orders_status", "revenue_manager",
  "top_products",
] as const;
export type ChartId = (typeof CHART_IDS)[number];

export const CHART_SECTION: Record<ChartId, SectionId> = {
  revenue_time:    "temporal",
  orders_time:     "temporal",
  orders_status:   "distribution",
  revenue_manager: "distribution",
  top_products:    "products",
};

export const DEFAULT_CHART_COLORS: Record<ChartId, string> = {
  revenue_time:    "#00BCD4",
  orders_time:     "#5470C6",
  orders_status:   "#00BCD4",
  revenue_manager: "#91CC75",
  top_products:    "#FAC858",
};

export const COLOR_PALETTE = [
  "#00BCD4", "#5470C6", "#91CC75", "#FAC858",
  "#EE6666", "#FC8452", "#9A60B4", "#73C0DE",
];

// ── Tables ────────────────────────────────────────────────────────────────────
export const TABLE_IDS = ["table_repeat", "table_manager"] as const;
export type TableId = (typeof TABLE_IDS)[number];

// ── Config interfaces ─────────────────────────────────────────────────────────
export interface SectionConfig { id: SectionId; visible: boolean; }
export interface KpiConfig     { id: KpiId;     visible: boolean; }
export interface ChartConfig   { id: ChartId;   visible: boolean; color: string; }
export interface TableConfig   { id: TableId;   visible: boolean; }

export interface FullLayout {
  sections: SectionConfig[];
  kpis:     KpiConfig[];
  charts:   ChartConfig[];  // ordered for display
  tables:   TableConfig[];
}

const storageKey = (userId: string) => `simla_full_layout_${userId}`;

function defaultLayout(): FullLayout {
  return {
    sections: SECTION_IDS.map((id) => ({ id, visible: true })),
    kpis:     KPI_IDS.map((id)  => ({ id, visible: true })),
    charts:   CHART_IDS.map((id) => ({ id, visible: true, color: DEFAULT_CHART_COLORS[id] })),
    tables:   TABLE_IDS.map((id) => ({ id, visible: true })),
  };
}

export function loadFullLayout(userId = "default"): FullLayout {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultLayout();
    const p: Partial<FullLayout> = JSON.parse(raw);
    const def = defaultLayout();

    const secMap = new Map((p.sections ?? []).map((s) => [s.id, s]));
    const kpiMap = new Map((p.kpis ?? []).map((k) => [k.id, k]));
    const tblMap = new Map((p.tables ?? []).map((t) => [t.id, t]));

    // charts: preserve stored order, merge, append new ones
    const storedCharts = (p.charts ?? []).filter((c) => (CHART_IDS as readonly string[]).includes(c.id));
    const storedIds = new Set(storedCharts.map((c) => c.id));
    const defChartMap = new Map(def.charts.map((c) => [c.id, c]));
    const charts: ChartConfig[] = [
      ...storedCharts.map((c) => ({ ...defChartMap.get(c.id)!, ...c })),
      ...def.charts.filter((c) => !storedIds.has(c.id)),
    ];

    return {
      sections: def.sections.map((s) => ({ ...s, ...secMap.get(s.id) })),
      kpis:     def.kpis.map((k)  => ({ ...k, ...kpiMap.get(k.id) })),
      charts,
      tables:   def.tables.map((t) => ({ ...t, ...tblMap.get(t.id) })),
    };
  } catch {
    return defaultLayout();
  }
}

export function saveFullLayout(layout: FullLayout, userId = "default"): void {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(layout)); } catch { /* ignore */ }
}

// Count items that are effectively visible (item.visible AND section.visible)
export function countVisible(layout: FullLayout): number {
  const sv = new Map(layout.sections.map((s) => [s.id, s.visible]));
  return (
    layout.kpis.filter((k)   => k.visible && sv.get("summary")).length +
    layout.charts.filter((c) => c.visible && sv.get(CHART_SECTION[c.id])).length +
    layout.tables.filter((t) => t.visible && sv.get("detail")).length
  );
}
