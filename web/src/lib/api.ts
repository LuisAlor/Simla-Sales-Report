const BASE = "/api/v5";
const PAGE_LIMIT = 100;
const WORKERS = 10;

// ---------------------------------------------------------------------------
// Raw API types
// ---------------------------------------------------------------------------

export interface RawOrder {
  id: number;
  number: string;
  createdAt: string;
  status: string;
  orderType?: string;
  summ: number;
  totalSumm: number;
  prepaySum: number;
  purchaseSumm: number;
  managerId?: number;
  manager?: { id: number; firstName: string; lastName: string };
  customer?: { id: number; firstName: string; lastName: string; email?: string };
  items?: RawItem[];
  customFields?: Record<string, unknown>;
  source?: { source?: string; medium?: string; campaign?: string; keyword?: string; content?: string };
}

export interface RawItem {
  id: number;
  productName: string;
  quantity: number;
  initialPrice: number;
  discountPercent: number;
  purchasePrice: number;
}

export interface OrderType {
  code: string;
  name: string;
}

export interface SimlaUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  groups?: { code: string }[];
}

export interface SimlaStatus {
  code: string;
  name: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a query string. Top-level keys are sent as-is; nested filter fields
// must use PHP bracket notation: filter[createdAtFrom]=... so the API parses them.
// arrayFilter supports PHP bracket array notation: filter[key][]=val
function buildQs(
  topLevel: Record<string, string | number>,
  filter: Record<string, string | number> = {},
  arrayFilter: Record<string, string[]> = {}
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(topLevel)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  for (const [k, v] of Object.entries(filter)) {
    // Brackets must NOT be encoded — PHP/Simla expects literal filter[key]
    parts.push(`filter[${k}]=${encodeURIComponent(String(v))}`);
  }
  for (const [k, vals] of Object.entries(arrayFilter)) {
    for (const v of vals) {
      parts.push(`filter[${k}][]=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

async function getJson<T>(
  path: string,
  apiKey: string,
  topLevel: Record<string, string | number> = {},
  filter: Record<string, string | number> = {},
  arrayFilter: Record<string, string[]> = {}
): Promise<T> {
  const qs = buildQs({ ...topLevel, apiKey }, filter, arrayFilter);
  const url = `${BASE}/${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

async function fetchPage(
  apiKey: string,
  topLevel: Record<string, string | number>,
  filter: Record<string, string | number>,
  arrayFilter: Record<string, string[]>,
  page: number
): Promise<RawOrder[]> {
  const data = await getJson<{ orders: RawOrder[] }>("orders", apiKey, { ...topLevel, page }, filter, arrayFilter);
  return data.orders ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchOrderTypes(apiKey: string): Promise<OrderType[]> {
  const data = await getJson<{ orderTypes: OrderType[] }>("reference/order-types", apiKey, {}, {});
  return data.orderTypes ?? [];
}

// GET /api/v5/users with filter[groups][]=sales
export async function fetchUsers(apiKey: string): Promise<SimlaUser[]> {
  const data = await getJson<{ users: SimlaUser[] }>(
    "users",
    apiKey,
    {},
    {},
    { groups: ["sales"] }
  );
  return data.users ?? [];
}

// GET /api/v5/reference/statuses
export async function fetchStatuses(apiKey: string): Promise<SimlaStatus[]> {
  const data = await getJson<{ statuses: SimlaStatus[] | Record<string, SimlaStatus> }>(
    "reference/statuses",
    apiKey,
    {},
    {}
  );
  const raw = data.statuses;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

export interface FetchOrdersParams {
  apiKey: string;
  dateFrom: string;
  dateTo: string;
  orderType?: string;
  onProgress?: (done: number, total: number) => void;
}

export async function fetchOrders(p: FetchOrdersParams): Promise<RawOrder[]> {
  const filter: Record<string, string | number> = {
    createdAtFrom: `${p.dateFrom} 00:00:00`,
    createdAtTo: `${p.dateTo} 23:59:59`,
  };
  if (p.orderType) filter["orderType"] = p.orderType;

  const arrayFilter: Record<string, string[]> = {};

  const topLevel: Record<string, string | number> = { limit: PAGE_LIMIT };

  // Page 1 to discover total pages
  const first = await getJson<{ orders: RawOrder[]; pagination: { totalPageCount: number } }>(
    "orders",
    p.apiKey,
    { ...topLevel, page: 1 },
    filter,
    arrayFilter
  );
  const totalPages = first.pagination?.totalPageCount ?? 1;
  const results: Map<number, RawOrder[]> = new Map([[1, first.orders ?? []]]);

  p.onProgress?.(1, totalPages);

  if (totalPages > 1) {
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    let done = 1;

    // Fetch in batches of WORKERS
    for (let i = 0; i < remaining.length; i += WORKERS) {
      const batch = remaining.slice(i, i + WORKERS);
      const fetched = await Promise.all(
        batch.map((page) =>
          fetchPage(p.apiKey, topLevel, filter, arrayFilter, page).then((rows) => ({ page, rows }))
        )
      );
      for (const { page, rows } of fetched) {
        results.set(page, rows);
        done++;
        p.onProgress?.(done, totalPages);
      }
    }
  }

  const all: RawOrder[] = [];
  for (let pg = 1; pg <= totalPages; pg++) {
    all.push(...(results.get(pg) ?? []));
  }
  return all;
}
