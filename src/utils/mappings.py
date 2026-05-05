"""Status labels, funnel stage groupings, and custom field definitions."""

STATUS_LABELS: dict[str, str] = {
    "crm-has-created": "📂 CRM Creado",
    "prezentatsiia-naznachena": "📅 Presentación programada",
    "presentacion-realizada": "👨‍🏫 Presentación realizada",
    "kp-otpravleno": "💌 Cotización enviada",
    "cotizacion-informativa": "📧 Cotización informativa",
    "decision-selection-holded": "🕒 Plazo decisión 1-3 meses",
    "seguimiento-a-largo-plazo": "🔁 Seguimiento largo plazo",
    "waiting-for-1st-payment": "🧾 Factura emitida",
    "pago-solo-licencia-y-no-contesta-oplatil-i-ne-otvechaet": "🪙 Pago licencia y no contesta",
    "poluchen-1-platezh-1": "💰 Primer pago recibido",
    "ne-prishel-na-prezentatsiiu": "💔 No asistió a la presentación",
    "contact-impossible": "😴 No se pudo contactar",
    "prospecto-clave-inactivo-lid-kliuchevoi-neaktiven": "🥇 Lead potencial inactivo",
    "nptp-caa": "💸 No le gustaron las tarifas",
    "product-did-not-suit": "🔩 No se adaptó al CRM",
    "slishkom-malenkii-biznes": "🌱 Negocio demasiado pequeño",
    "no-cumple-requisitos-waba-meta": "📛 No cumple requisitos WABA",
    "ne-interesen-produkt": "😪 No le interesó el producto",
    "vybrali-konkurentov": "💼 Escogió a la competencia",
    "oshibki-produkta": "👾 Error en el producto",
    "not-our": "🙅‍♀️ No es nuestro cliente",
    "iwip": "👨‍💻 Integración del CRM",
    "pago-paquete-vip": "⭐️ Pagó paquete VIP",
    "rabochaya": "🟢 Maintenance",
    "solicito-reembolso": "💸 Solicitó reembolso",
    "no-quiso": "🙅‍♂️ No quiso seguir con Simla.com",
    "dejo-de-contestar-kam-soporte": "🤐 Dejó de contestar (KAM)",
    "zakryl-biznes": "🪦 Cerraron su negocio",
    "en-pausa": "⏳ En pausa",
    "transfer-to-russia": "↔️ Transferido a Rusia",
    "order-double": "👥 Pedido doble",
    "test-employee-simlacom": "🗿 Cuenta prueba de empleado",
}

# Each entry: (status_code, popadal_v_statusy_code)
FUNNEL_KEY_STAGES: list[tuple[str, str]] = [
    ("crm-has-created",     "crm-creado-novaia-registratsiia"),
    ("prezentatsiia-naznachena", "presentacion-programada-prezentatsiia-naznachena"),
    ("presentacion-realizada",   "presentacion-realizada-provedena-prezentatsiia"),
    ("kp-otpravleno",            "cotizacion-enviada-kp-otpravleno"),
    ("cotizacion-informativa",   "cotizacion-informativa-info-kp"),
    ("decision-selection-holded","plazo-de-decision-1-3-meses-srok-resheniia-1-3-mes"),
    ("seguimiento-a-largo-plazo","seguimiento-largo-plazo-dolgosrochnoe-soprovozhdenie"),
    ("waiting-for-1st-payment",  "factura-emitida-schiot-vystavlen"),
    ("pago-solo-licencia-y-no-contesta-oplatil-i-ne-otvechaet",
                                 "pago-licencia-y-no-contesta-oplatil-i-ne-otvechaet"),
    ("poluchen-1-platezh-1",     "primer-pago-recibido-poluchen-1-platezh"),
]

FUNNEL_NEGATIVE_STAGES: list[tuple[str, str]] = [
    ("ne-prishel-na-prezentatsiiu",                          "no-asistio-a-la-presentacion-ne-prishel-na-prezentatsiiu"),
    ("contact-impossible",                                   "no-se-pudo-contactar-perestal-otvechat"),
    ("prospecto-clave-inactivo-lid-kliuchevoi-neaktiven",    "lead-potencial-inactivo-lid-kliuchevoi-neaktiven"),
    ("nptp-caa",                                             "no-le-gustaron-las-tarifas-dorogo"),
    ("product-did-not-suit",                                 "no-se-adapto-a-funcionalidad-del-crm-net-fichei"),
    ("slishkom-malenkii-biznes",                             "negocio-demasiado-pequeno-malenkii-biznes"),
    ("no-cumple-requisitos-waba-meta",                       "no-cumple-requisitos-waba-meta"),
    ("ne-interesen-produkt",                                 "no-le-intereso-el-producto-ne-interesen-produkt"),
    ("vybrali-konkurentov",                                  "escogio-a-la-competencia-vybral-konkurenta"),
    ("oshibki-produkta",                                     "error-en-el-producto-oshibki-produkta"),
    ("not-our",                                              "no-es-nuestro-cliente-nekachestvennyi-lid"),
]

FUNNEL_POSTSALES_STAGES: list[tuple[str, str]] = [
    ("iwip",                     "integracion-del-crm-na-integratsii"),
    ("pago-paquete-vip",         "pago-paquete-vip"),
    ("rabochaya",                "maintenance-peredan-na-obsluzhivanie"),
    ("solicito-reembolso",       "solicito-reembolso-kam-soporte"),
    ("no-quiso",                 "no-quiso-seguir-con-simla-com-kam-soporte"),
    ("dejo-de-contestar-kam-soporte", "dejo-de-contestar-kam-soporte"),
    ("zakryl-biznes",            "cerraron-su-negocio-kam-soporte"),
    ("en-pausa",                 "en-pausa-kam-soporte"),
]

# popadal_v_statusy code for "primer pago recibido" (used in financial calcs)
PAID_STATUS_CODE   = "primer-pago-recibido-poluchen-1-platezh"
REFUND_STATUS_CODE = "solicito-reembolso-kam-soporte"
