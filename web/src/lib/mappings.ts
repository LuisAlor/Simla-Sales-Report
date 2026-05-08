export const STATUS_LABELS: Record<string, string> = {
  "nuevo-lead": "Nuevo lead",
  "primer-contacto": "Primer contacto",
  "contactado": "Contactado",
  "presentacion-enviada": "Presentación enviada",
  "demo-agendada": "Demo agendada",
  "demo-realizada": "Demo realizada",
  "propuesta-enviada": "Propuesta enviada",
  "negociacion": "Negociación",
  "primer-pago-recibido-poluchen-1-platezh": "1er Pago recibido",
  "onboarding": "Onboarding",
  "cliente-activo": "Cliente activo",
  "renovacion": "Renovación",
  "churn": "Churn",
  "no-contactado": "No contactado",
  "sin-interes": "Sin interés",
  "no-califica": "No califica",
  "perdido-precio": "Perdido — precio",
  "perdido-competencia": "Perdido — competencia",
  "perdido-tiempo": "Perdido — tiempo",
  "solicito-reembolso-kam-soporte": "Solicitó reembolso",
  "reembolso-procesado": "Reembolso procesado",
  "pausado": "Pausado",
  "trial": "Trial",
  "trial-vencido": "Trial vencido",
  "calificado": "Calificado",
  "por-renovar": "Por renovar",
  "renovado": "Renovado",
  "upsell": "Upsell",
  "downsell": "Downsell",
  "referido": "Referido",
};

export const PAID_STATUS_CODE = "primer-pago-recibido-poluchen-1-platezh";
export const REFUND_STATUS_CODE = "solicito-reembolso-kam-soporte";

export type StageEntry = [statusCode: string, popadalCode: string];

export const FUNNEL_KEY_STAGES: StageEntry[] = [
  ["nuevo-lead",              "nuevo-lead"],
  ["contactado",              "contactado"],
  ["demo-agendada",           "demo-agendada"],
  ["demo-realizada",          "demo-realizada"],
  ["propuesta-enviada",       "propuesta-enviada"],
  ["negociacion",             "negociacion"],
  ["primer-pago-recibido-poluchen-1-platezh", "primer-pago-recibido-poluchen-1-platezh"],
  ["onboarding",              "onboarding"],
  ["cliente-activo",          "cliente-activo"],
  ["renovacion",              "renovacion"],
];

export const FUNNEL_NEGATIVE_STAGES: StageEntry[] = [
  ["no-contactado",       "no-contactado"],
  ["sin-interes",         "sin-interes"],
  ["no-califica",         "no-califica"],
  ["perdido-precio",      "perdido-precio"],
  ["perdido-competencia", "perdido-competencia"],
  ["perdido-tiempo",      "perdido-tiempo"],
  ["churn",               "churn"],
  ["trial-vencido",       "trial-vencido"],
  ["solicito-reembolso-kam-soporte", "solicito-reembolso-kam-soporte"],
  ["reembolso-procesado", "reembolso-procesado"],
  ["pausado",             "pausado"],
];

export const FUNNEL_POSTSALES_STAGES: StageEntry[] = [
  ["onboarding",    "onboarding"],
  ["cliente-activo","cliente-activo"],
  ["por-renovar",   "por-renovar"],
  ["renovacion",    "renovacion"],
  ["renovado",      "renovado"],
  ["upsell",        "upsell"],
  ["downsell",      "downsell"],
  ["churn",         "churn"],
];

export const FUNNEL_COLORS = [
  "#4FC3F7", "#EF5350", "#66BB6A", "#FF7043", "#AB47BC",
  "#FFA726", "#26C6DA", "#EC407A", "#8D6E63", "#29B6F6",
  "#A5D6A7",
];

export const PALETTE = [
  "#00BCD4", "#2563EB", "#7C3AED", "#F59E0B",
  "#10B981", "#EF4444", "#6366F1", "#94A3B8",
];

export const PLATFORM_LABELS: Record<string, string> = {
  "otra":         "Otra",
  "ninguna":      "Ninguna",
  "desconocida":  "Desconocida",
  "desconocido":  "Desconocido",
  "manychat":     "ManyChat",
  "facebook":     "Facebook",
  "instagram":    "Instagram",
  "whatsapp":     "WhatsApp",
  "telegram":     "Telegram",
  "linkedin":     "LinkedIn",
  "twitter":      "Twitter / X",
  "tiktok":       "TikTok",
  "google":       "Google",
  "youtube":      "YouTube",
  "email":        "Email",
  "web":          "Web",
  "referido":     "Referido",
  "referral":     "Referido",
};
