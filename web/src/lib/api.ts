const BASE = "https://base.simla.com/api/v5";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiUrl(path: string, params: Record<string, string | number>): string {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function getJson<T>(
  path: string,
  apiKey: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = apiUrl(path, { ...params, apiKey });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

async function fetchPage(
  apiKey: string,
  params: Record<string, string | number>,
  page: number
): Promise<RawOrder[]> {
  const data = await getJson<{ orders: RawOrder[] }>("orders", apiKey, {
    ...params,
    page,
    limit: PAGE_LIMIT,
  });
  return data.orders ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchOrderTypes(apiKey: string): Promise<OrderType[]> {
  const data = await getJson<{ orderTypes: OrderType[] }>("order-types", apiKey);
  return data.orderTypes ?? [];
}

export interface FetchOrdersParams {
  apiKey: string;
  dateFrom: string;
  dateTo: string;
  orderType?: string;
  managerId?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function fetchOrders(p: FetchOrdersParams): Promise<RawOrder[]> {
  const params: Record<string, string | number> = {
    createdAtFrom: `${p.dateFrom} 00:00:00`,
    createdAtTo: `${p.dateTo} 23:59:59`,
    limit: PAGE_LIMIT,
  };
  if (p.orderType) params["orderType"] = p.orderType;
  if (p.managerId) params["managerId"] = p.managerId;

  // Page 1 to discover total pages
  const first = await getJson<{ orders: RawOrder[]; pagination: { totalPageCount: number } }>(
    "orders",
    p.apiKey,
    { ...params, page: 1 }
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
        batch.map((page) => fetchPage(p.apiKey, params, page).then((rows) => ({ page, rows })))
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
