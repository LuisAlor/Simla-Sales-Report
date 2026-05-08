export const CHART_IDS = [
  "revenue_time",
  "orders_time",
  "orders_status",
  "revenue_manager",
  "top_products",
] as const;

export type ChartId = (typeof CHART_IDS)[number];

export interface ChartConfig {
  id: ChartId;
  visible: boolean;
}

const STORAGE_KEY = "simla_chart_layout";

export function loadChartLayout(): ChartConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: ChartConfig[] = JSON.parse(raw);
      const valid = parsed.filter((c) => (CHART_IDS as readonly string[]).includes(c.id));
      const storedIds = new Set(valid.map((c) => c.id));
      const added = CHART_IDS.filter((id) => !storedIds.has(id)).map((id) => ({ id, visible: true }));
      return [...valid, ...added];
    }
  } catch {
    // ignore
  }
  return CHART_IDS.map((id) => ({ id, visible: true }));
}

export function saveChartLayout(layout: ChartConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}
