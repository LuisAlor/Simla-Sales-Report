import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import type { OrderRecord, ItemRecord } from "./flatten";
import {
  PAID_STATUS_CODE,
  REFUND_STATUS_CODE,
  PLATFORM_LABELS,
  SECTOR_LABELS,
  type StageEntry,
} from "./mappings";

dayjs.extend(weekOfYear);

export type Freq = "D" | "W" | "ME";

// ---------------------------------------------------------------------------
// Date bucketing
// ---------------------------------------------------------------------------

function bucket(iso: string, freq: Freq): string {
  const d = dayjs(iso);
  if (freq === "D") return d.format("YYYY-MM-DD");
  if (freq === "W") return d.startOf("week").format("YYYY-MM-DD");
  return d.startOf("month").format("YYYY-MM-DD");
}

// ---------------------------------------------------------------------------
// General analytics transforms
// ---------------------------------------------------------------------------

export interface TsPoint {
  date: string;
  revenue: number;
  orders: number;
}

export function revenueOverTime(records: OrderRecord[], freq: Freq): TsPoint[] {
  const map = new Map<string, TsPoint>();
  for (const r of records) {
    const d = bucket(r.createdAt, freq);
    const existing = map.get(d) ?? { date: d, revenue: 0, orders: 0 };
    map.set(d, { date: d, revenue: existing.revenue + r.totalSumm, orders: existing.orders + 1 });
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

export interface StatusRow {
  status: string;
  orders: number;
  revenue: number;
}

export function ordersByStatus(records: OrderRecord[]): StatusRow[] {
  const map = new Map<string, StatusRow>();
  for (const r of records) {
    const s = r.status ?? "(sin estado)";
    const existing = map.get(s) ?? { status: s, orders: 0, revenue: 0 };
    map.set(s, { status: s, orders: existing.orders + 1, revenue: existing.revenue + r.totalSumm });
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}

export interface ManagerRow {
  managerId: number | null;
  managerName: string;
  orders: number;
  revenue: number;
  avgOrder: number;
}

export const NO_MANAGER_KEY = "__no_manager__";

export function ordersByManager(records: OrderRecord[]): ManagerRow[] {
  const map = new Map<string, ManagerRow>();
  for (const r of records) {
    const key = r.managerSd || r.managerName || NO_MANAGER_KEY;
    const existing = map.get(key) ?? { managerId: r.managerId, managerName: key, orders: 0, revenue: 0, avgOrder: 0 };
    const updated = { ...existing, orders: existing.orders + 1, revenue: existing.revenue + r.totalSumm };
    updated.avgOrder = updated.revenue / updated.orders;
    map.set(key, updated);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface ProductRow {
  productName: string;
  quantity: number;
  revenue: number;
}

export function topProducts(items: ItemRecord[], n = 15): ProductRow[] {
  const map = new Map<string, ProductRow>();
  for (const item of items) {
    const key = item.productName || "(sin nombre)";
    const existing = map.get(key) ?? { productName: key, quantity: 0, revenue: 0 };
    map.set(key, { productName: key, quantity: existing.quantity + item.quantity, revenue: existing.revenue + item.revenue });
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

export interface RepeatCustomer {
  customerId: number | null;
  customerName: string;
  orders: number;
  revenue: number;
}

export function repeatCustomers(records: OrderRecord[]): RepeatCustomer[] {
  const map = new Map<string, RepeatCustomer>();
  for (const r of records) {
    const key = String(r.customerId ?? r.customerName ?? "?");
    const existing = map.get(key) ?? { customerId: r.customerId, customerName: r.customerName, orders: 0, revenue: 0 };
    map.set(key, { ...existing, orders: existing.orders + 1, revenue: existing.revenue + r.totalSumm });
  }
  return [...map.values()].filter((c) => c.orders > 1).sort((a, b) => b.orders - a.orders);
}

// ---------------------------------------------------------------------------
// Funnel transforms
// ---------------------------------------------------------------------------

function hasStage(record: OrderRecord, code: string): boolean {
  return record.popadalVStatusy.includes(code);
}

export interface StageRow {
  statusCode: string;
  label: string;
  count: number;
  crPct: number;
}

export function funnelStageCounts(records: OrderRecord[], stages: StageEntry[], base?: number): StageRow[] {
  const denominator = base ?? records.length;
  return stages.map(([label, popadalCode]) => {
    const count = records.filter((r) => hasStage(r, popadalCode)).length;
    return {
      statusCode: popadalCode,
      label,
      count,
      crPct: denominator > 0 ? Math.round((count / denominator) * 100) : 0,
    };
  });
}

export interface FunnelTsPoint {
  date: string;
  [stageName: string]: string | number;
}

export function funnelOverTime(
  records: OrderRecord[],
  stages: StageEntry[],
  freq: Freq
): FunnelTsPoint[] {
  const bucketMap = new Map<string, Map<string, number>>();

  for (const r of records) {
    const d = bucket(r.createdAt, freq);
    if (!bucketMap.has(d)) bucketMap.set(d, new Map());
    const stageMap = bucketMap.get(d)!;
    for (const [label, popadalCode] of stages) {
      if (hasStage(r, popadalCode)) {
        stageMap.set(label, (stageMap.get(label) ?? 0) + 1);
      }
    }
  }

  const stageLabels = stages.map(([label]) => label);
  return [...bucketMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stageMap]) => {
      const point: FunnelTsPoint = { date };
      for (const label of stageLabels) {
        point[label] = stageMap.get(label) ?? 0;
      }
      return point;
    });
}

export interface FinancialKpis {
  totalSales: number;
  mrr: number;
  sarpu: number;
  refunded: number;
  netTotal: number;
}

export function financialKpis(records: OrderRecord[]): FinancialKpis {
  // Use popadal code when available; fall back to cfFirstPayment > 0 when the
  // stage wasn't recorded in popadal_v_statusy (e.g. orders pre-dating the field)
  const paid = records.filter((r) => hasStage(r, PAID_STATUS_CODE) || r.cfFirstPayment > 0);
  const refund = records.filter((r) => hasStage(r, REFUND_STATUS_CODE) || r.cfRefunded > 0);

  const sarpu = paid.reduce((s, r) => s + r.cfFirstPayment, 0);
  const mrr = paid.reduce((s, r) => s + (r.cfPaymentPeriod > 0 ? r.cfFirstPayment / r.cfPaymentPeriod : 0), 0);
  const refunded = refund.reduce((s, r) => s + r.cfRefunded, 0);

  return {
    totalSales: paid.length,
    mrr,
    sarpu,
    refunded,
    netTotal: sarpu - refunded,
  };
}

export interface PlatformRow {
  platform: string;
  count: number;
}

const NO_DATA = "No rellenado";

export function platformsBreakdown(records: OrderRecord[]): PlatformRow[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const raw = (r.cfPrevPlatform ?? "").trim();
    const label = raw ? (PLATFORM_LABELS[raw.toLowerCase()] ?? raw) : NO_DATA;
    const key = label === "No rellenado" ? NO_DATA : label;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => a.platform === NO_DATA ? 1 : b.platform === NO_DATA ? -1 : b.count - a.count);
}

export function sectorBreakdown(records: OrderRecord[]): PlatformRow[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const raw = (r.cfSector ?? "").trim();
    const name = raw ? (SECTOR_LABELS[raw.toLowerCase()] ?? raw) : NO_DATA;
    const key = name === "No rellenado" ? NO_DATA : name;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => a.platform === NO_DATA ? 1 : b.platform === NO_DATA ? -1 : b.count - a.count);
}
