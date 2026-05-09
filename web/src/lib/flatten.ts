import type { RawOrder, RawItem } from "./api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cfFloat(cf: Record<string, unknown>, key: string): number {
  const v = cf[key];
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function cfStr(cf: Record<string, unknown>, key: string): string | null {
  const v = cf[key];
  if (v === null || v === undefined) return null;
  return String(v);
}

// For select-type custom fields that return {code, name} objects
function cfSelectName(cf: Record<string, unknown>, key: string): string | null {
  const v = cf[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const obj = v as Record<string, string>;
    return obj["name"] ?? obj["code"] ?? null;
  }
  return String(v);
}

function cfList(cf: Record<string, unknown>, key: string): string[] {
  const v = cf[key];
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, string>)["code"] ?? "" : String(item)))
      .filter(Boolean);
  }
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Order record
// ---------------------------------------------------------------------------

export interface OrderRecord {
  id: number;
  number: string;
  createdAt: string;
  status: string;
  orderType: string | null;
  summ: number;
  totalSumm: number;
  prepaySum: number;
  purchaseSumm: number;
  margin: number;
  managerId: number | null;
  managerName: string;
  customerId: number | null;
  customerName: string;
  customerEmail: string | null;
  itemCount: number;
  utmSource: string | null;
  utmMedium: string | null;
  // custom fields
  cfNumUsers: string | null;
  cfClientBase: string | null;
  cfLeadsPerDay: string | null;
  cfSector: string | null;
  cfWinProbability: string | null;
  cfIsReferral: string | null;
  cfReturning: string | null;
  cfPrevPlatform: string | null;
  cfWhatsappType: string | null;
  cfSegment: string | null;
  cfFirstPayment: number;
  cfPaymentPeriod: number;
  cfRefunded: number;
  popadalVStatusy: string[];
  managerSd: string | null;
  cfDesktop: boolean;
  cfMobile:  boolean;
}

export function flattenOrder(o: RawOrder): OrderRecord {
  const mgr = o.manager ?? {};
  const cust = o.customer ?? {};
  const cf = o.customFields ?? {};

  const managerFirstName = (mgr as { firstName?: string }).firstName ?? "";
  const managerLastName = (mgr as { lastName?: string }).lastName ?? "";
  const custFirstName = (cust as { firstName?: string }).firstName ?? "";
  const custLastName = (cust as { lastName?: string }).lastName ?? "";

  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    orderType: o.orderType ?? null,
    summ: o.summ ?? 0,
    totalSumm: o.totalSumm ?? 0,
    prepaySum: o.prepaySum ?? 0,
    purchaseSumm: o.purchaseSumm ?? 0,
    margin: (o.totalSumm ?? 0) - (o.purchaseSumm ?? 0),
    managerId: (mgr as { id?: number }).id ?? o.managerId ?? null,
    managerName: [managerFirstName, managerLastName].filter(Boolean).join(" "),
    customerId: (cust as { id?: number }).id ?? null,
    customerName: [custFirstName, custLastName].filter(Boolean).join(" "),
    customerEmail: (cust as { email?: string }).email ?? null,
    itemCount: (o.items ?? []).length,
    utmSource: o.source?.source ?? null,
    utmMedium: o.source?.medium ?? null,
    cfNumUsers:       cfStr(cf, "crm_num_of_users_new"),
    cfClientBase:     cfStr(cf, "tamano_de_base_de_clientes"),
    cfLeadsPerDay:    cfStr(cf, "leads_por_dia"),
    cfSector:         cfSelectName(cf, "sector"),
    cfWinProbability: cfStr(cf, "win_probability"),
    cfIsReferral:     cfStr(cf, "is_client_referral_order"),
    cfReturning:      cfStr(cf, "cliente_retornado"),
    cfPrevPlatform:   cfStr(cf, "plataforma_previa"),
    cfWhatsappType:   cfStr(cf, "tipo_de_whatsapp"),
    cfSegment:        cfStr(cf, "segment_lida"),
    cfFirstPayment:   cfFloat(cf, "the_amount_of_the_first_payment"),
    cfPaymentPeriod:  cfFloat(cf, "payment_first_period_license"),
    cfRefunded:       cfFloat(cf, "refunded_amount"),
    popadalVStatusy:  cfList(cf, "popadal_v_statusy"),
    // DEBUG — remove once popadal codes are confirmed correct:
    ...(() => { if (cf["popadal_v_statusy"]) console.debug("[popadal raw]", o.id, cf["popadal_v_statusy"]); return {}; })(),
    managerSd:        cfSelectName(cf, "manager_sd"),
    cfDesktop: ["true", "1", true, 1].includes(cf["amplitude_creator_first_login_desktop"] as string | boolean | number),
    cfMobile:  ["true", "1", true, 1].includes(cf["amplitude_creator_first_login_mobile"]  as string | boolean | number),
  };
}

export interface ItemRecord {
  orderId: number;
  createdAt: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  purchasePrice: number;
  revenue: number;
}

export function flattenItem(o: RawOrder, item: RawItem): ItemRecord {
  return {
    orderId: o.id,
    createdAt: o.createdAt,
    productName: item.offer?.displayName ?? item.offer?.name ?? item.productName ?? "",
    quantity: item.quantity ?? 0,
    unitPrice: item.initialPrice ?? 0,
    discountPercent: item.discountPercent ?? 0,
    purchasePrice: item.purchasePrice ?? 0,
    revenue: (item.quantity ?? 0) * (item.initialPrice ?? 0),
  };
}

export function flattenAll(orders: RawOrder[]): {
  records: OrderRecord[];
  items: ItemRecord[];
} {
  const records = orders.map(flattenOrder);
  const items = orders.flatMap((o) =>
    (o.items ?? []).map((item) => flattenItem(o, item))
  );
  return { records, items };
}
