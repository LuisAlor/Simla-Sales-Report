// Real CRM order status code → display label
export const STATUS_LABELS: Record<string, string> = {
  "crm-has-created":                                "📂 CRM Creado",
  "prezentatsiia-naznachena":                       "📅 Presentación programada",
  "ne-prishel-na-prezentatsiiu":                    "💔 No asistió a la presentación",
  "contact-impossible":                             "😴 No se pudo contactar",
  "pago-solo-licencia-y-no-contesta-oplatil-i-ne-otvechaet": "🪙 Pago licencia y no contesta",
  "prospecto-clave-inactivo-lid-kliuchevoi-neaktiven": "💎 Lead potencial inactivo",
  "seguimiento-a-largo-plazo":                      "🔁 Seguimiento largo plazo",
  "presentacion-realizada":                         "👨‍🏫 Presentación realizada",
  "cotizacion-informativa":                         "📧 Cotización informativa",
  "kp-otpravleno":                                  "💌 Cotización enviada",
  "decision-selection-holded":                      "🕒 Plazo de decisión 1-3 meses",
  "waiting-for-1st-payment":                        "🧾 Factura emitida",
  "poluchen-1-platezh-1":                           "💰 Primer pago recibido",
  "iwip":                                           "👨‍💻 Integración del CRM",
  "rabochaya":                                      "🟢 Maintenance",
  "pago-paquete-vip":                               "⭐️ Pagó paquete VIP",
  "nptp-caa":                                       "💸 No le gustaron las tarifas",
  "product-did-not-suit":                           "🔩 No se adaptó a funcionalidad",
  "slishkom-malenkii-biznes":                       "🌱 Negocio demasiado pequeño",
  "no-cumple-requisitos-waba-meta":                 "📛 No cumple requisitos WABA",
  "ne-interesen-produkt":                           "😪 No le intereso el producto",
  "vybrali-konkurentov":                            "💼 Escogió a la competencia",
  "oshibki-produkta":                               "👾 Error en el producto",
  "not-our":                                        "🙅 No es nuestro cliente",
  "transfer-to-russia":                             "↔️ Transferido a Rusia",
  "order-double":                                   "👥 Pedido doble",
  "test-employee-simlacom":                         "🗿 Cuenta prueba de empleado",
  "no-quiso":                                       "🙅‍♂️ No quiso seguir con Simla",
  "solicito-reembolso":                             "💸 Solicitó reembolso",
  "dejo-de-contestar-kam-soporte":                  "🤐 Dejó de contestar",
  "zakryl-biznes":                                  "🪦 Cerraron su negocio",
  "en-pausa":                                       "⏳ En pausa",
};

// Status codes to exclude from "Fact registraciones" count
export const EXCLUDED_STATUS_CODES = [
  "test-employee-simlacom",
  "order-double",
  "transfer-to-russia",
];

// popadal code used to identify paid orders
export const PAID_STATUS_CODE  = "primer-pago-recibido-poluchen-1-platezh";
// popadal code used to identify refund orders
export const REFUND_STATUS_CODE = "solicito-reembolso-kam-soporte";

// StageEntry: [displayLabel, popadalVStatusy code]
export type StageEntry = [label: string, popadalCode: string];

export const FUNNEL_KEY_STAGES: StageEntry[] = [
  ["📂 CRM Creado",               "crm-creado-novaia-registratsiia"],
  ["📅 Presentación programada",  "presentacion-programada-prezentatsiia-naznachena"],
  ["👨‍🏫 Presentación realizada",  "presentacion-realizada-provedena-prezentatsiia"],
  ["📧 Cotización informativa",   "cotizacion-informativa-info-kp"],
  ["💌 Cotización enviada",       "cotizacion-enviada-kp-otpravleno"],
  ["🕒 Plazo decisión 1-3 meses", "plazo-de-decision-1-3-meses-srok-resheniia-1-3-mes"],
  ["🧾 Factura emitida",          "factura-emitida-schiot-vystavlen"],
  ["🪙 Pago licencia/no contesta","pago-licencia-y-no-contesta-oplatil-i-ne-otvechaet"],
  ["💰 Primer pago recibido",     "primer-pago-recibido-poluchen-1-platezh"],
];

export const FUNNEL_NEGATIVE_STAGES: StageEntry[] = [
  ["💔 No asistió a la presentación",     "no-asistio-a-la-presentacion-ne-prishel-na-prezentatsiiu"],
  ["😴 No se pudo contactar",             "no-se-pudo-contactar-perestal-otvechat"],
  ["🥇 Lead potencial inactivo",          "lead-potencial-inactivo-lid-kliuchevoi-neaktiven"],
  ["🥈 Lead bajo potencial inactivo",     "seguimiento-largo-plazo-dolgosrochnoe-soprovozhdenie"],
  ["👽 Lead potencial dudoso inactivo",   "lead-de-potencial-dudoso-inactivo"],
  ["💸 No le gustaron las tarifas",       "no-le-gustaron-las-tarifas-dorogo"],
  ["🔩 No se adaptó a funcionalidad CRM", "no-se-adapto-a-funcionalidad-del-crm-net-fichei"],
  ["🌱 Negocio demasiado pequeño",        "negocio-demasiado-pequeno-malenkii-biznes"],
  ["📛 No cumple requisitos WABA",        "no-cumple-requisitos-waba-meta"],
  ["😪 No le interesó el producto",       "no-le-intereso-el-producto-ne-interesen-produkt"],
  ["💼 Escogió a la competencia",         "escogio-a-la-competencia-vybral-konkurenta"],
  ["👾 Error en el producto",             "error-en-el-producto-oshibki-produkta"],
  ["🙅‍♀️ No es nuestro cliente",          "no-es-nuestro-cliente-nekachestvennyi-lid"],
];

export const FUNNEL_POSTSALES_STAGES: StageEntry[] = [
  ["👨‍💻 Integración del CRM",       "integracion-del-crm-na-integratsii"],
  ["⭐️ Pagó paquete VIP",            "pago-paquete-vip"],
  ["🟢 Maintenance",                 "maintenance-peredan-na-obsluzhivanie"],
  ["💸 Solicitó reembolso",          "solicito-reembolso-kam-soporte"],
  ["🙅 No quiso seguir con Simla",   "no-quiso-seguir-con-simla-com-kam-soporte"],
  ["🤐 Dejó de contestar",           "dejo-de-contestar-kam-soporte"],
  ["🪦 Cerraron su negocio",         "cerraron-su-negocio-kam-soporte"],
  ["⏳ En pausa",                     "en-pausa-kam-soporte"],
];

export const FUNNEL_COLORS = [
  "#4FC3F7", "#EF5350", "#66BB6A", "#FF7043", "#AB47BC",
  "#FFA726", "#26C6DA", "#EC407A", "#8D6E63", "#29B6F6",
  "#A5D6A7", "#F48FB1", "#80CBC4", "#FFCC02", "#CE93D8",
];

export const PALETTE = [
  "#00BCD4", "#2563EB", "#7C3AED", "#F59E0B",
  "#10B981", "#EF4444", "#6366F1", "#94A3B8",
];

export const SECTOR_LABELS: Record<string, string> = {
  "desconocido":              "No rellenado",
  "farma":                    "Farmacéutico",
  "salud-clinicas":           "Salud (Clínicas)",
  "moda-textil":              "Moda / Textil",
  "regalos-flores":           "Regalos / Flores",
  "eventos-fiestas":          "Eventos / Fiestas",
  "turismo-viajes":           "Turismo / Viajes",
  "inmobiliario":             "Inmobiliario",
  "educacion":                "Educación",
  "marketing-publicidad":     "Marketing / Publicidad",
  "tecnologia-software":      "Tecnología / Software",
  "servicios-profesionales":  "Servicios profesionales",
  "reclutamiento":            "Reclutamiento",
  "automotriz":               "Automotriz",
  "logistica-entregas":       "Logística / Entregas",
  "deportes":                 "Deportes",
  "limpieza-higiene":         "Limpieza / Higiene",
  "bebes-ninos":              "Bebés / Niños",
  "retail-ecommerce":         "Retail / eCommerce",
  "dropshipping":             "Dropshipping",
  "cosmeticos":               "Cosméticos",
  "otro":                     "Otro",
};

export const PLATFORM_LABELS: Record<string, string> = {
  "ninguna":               "No rellenado",
  "desconocida":           "No rellenado",
  "desconocido":           "No rellenado",
  "otra":                  "Otra",
  "kommo":                 "Kommo",
  "clientify":             "Clientify",
  "mercateli":             "Mercately",
  "aurora-inbox":          "Aurora Inbox",
  "leadsales":             "Leadsales",
  "zenvia":                "Zenvia",
  "wati":                  "Wati",
  "hubspot":               "HubSpot",
  "callbell":              "Callbell",
  "zoho-crm":              "Zoho CRM",
  "bitrix24":              "Bitrix24",
  "trevio":                "Trevio",
  "odoo":                  "Odoo",
  "monday":                "Monday",
  "brevo":                 "Brevo",
  "activecampaign":        "ActiveCampaign",
  "klaviyo":               "Klaviyo",
  "microsoft-dynamics-365":"Microsoft Dynamics 365",
  "intercom":              "Intercom",
  "salesforce":            "Salesforce",
  "zendesk":               "Zendesk",
  "whaticket":             "Whaticket",
  "b2chat":                "B2Chat",
  "manychat":              "ManyChat",
  "respond-io":            "Respond.io",
  "meta-business-suite":   "Meta Business Suite",
  "n8n":                   "N8N",
  "facebook":              "Facebook",
  "instagram":             "Instagram",
  "whatsapp":              "WhatsApp",
  "telegram":              "Telegram",
  "linkedin":              "LinkedIn",
  "twitter":               "Twitter / X",
  "tiktok":                "TikTok",
  "google":                "Google",
  "youtube":               "YouTube",
  "email":                 "Email",
  "web":                   "Web",
  "referido":              "Referido",
  "referral":              "Referido",
};
