import { useState, useEffect, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import {
  Video,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Calendar,
  User,
  Hash,
  Building2,
  Play,
  UserCircle,
  Tag,
  CircleDot,
  Bot,
  Settings2,
  Eye,
  EyeOff,
  X,
  GripVertical,
  MessageSquare,
  HelpCircle,
  Clock,
} from "lucide-react";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useI18n } from "@/contexts/I18nContext";
import { fetchTldvTranscript, tldvMeetingUrl, extractMeetingId } from "@/lib/tldvApi";
import type { TldvTranscriptSegment } from "@/lib/tldvApi";
import { fetchOrdersByDemoDate } from "@/lib/api";
import type { RawOrder } from "@/lib/api";
import { callOpenAI, DEFAULT_OPENAI_MODEL, DEFAULT_AI_PROMPT } from "@/lib/openai";
import { MultiSelect } from "@/components/MultiSelect";
import { DateRangePicker } from "@/components/DateRangePicker";

interface Props {
  managerSdMap: Record<string, string>;
  statusLabels?: Record<string, string>;
}

interface DemoOrder {
  orderId: number;
  orderNumber: string;
  projectName: string;
  managerSd: string;
  managerSdLabel: string;
  demoDate: string;
  tldvUrl: string;
  meetingId: string;
  invalidUrl: boolean;
  customerName: string;
  crmField: string;
  mqlOrder: string;
  statusCode: string;
}

function isValidTldvMeetingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return (u.hostname === "tldv.io" || u.hostname.endsWith(".tldv.io")) &&
      parts[0] === "app" && parts[1] === "meetings" && (parts[2]?.length ?? 0) > 0;
  } catch { return false; }
}

const AI_REPORT_CACHE_PREFIX  = "simla_ai_report_v1_";
const DEMO_LIST_CACHE_PREFIX  = "simla_tldv_demos_v1_";
const TLDV_FILTER_LAYOUT_KEY  = "simla_tldv_filter_layout";

const TLDV_FILTER_DEFS = [
  { id: "date",      labelKey: "filter_creation_date" },
  { id: "manager",   labelKey: "filter_manager" },
  { id: "project",   labelKey: "tldv_filter_project" },
  { id: "order-num", labelKey: "tldv_filter_order_num" },
] as const;

type TldvFilterId = (typeof TLDV_FILTER_DEFS)[number]["id"];
type TldvFilterLayoutItem = { id: TldvFilterId; visible: boolean };

function loadTldvFilterLayout(): TldvFilterLayoutItem[] {
  try {
    const saved = localStorage.getItem(TLDV_FILTER_LAYOUT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as TldvFilterLayoutItem[];
      const ids = new Set(parsed.map((p) => p.id));
      const missing = TLDV_FILTER_DEFS.filter((f) => !ids.has(f.id)).map((f) => ({ id: f.id, visible: true }));
      return [...parsed, ...missing];
    }
  } catch { /* ignore */ }
  return TLDV_FILTER_DEFS.map((f) => ({ id: f.id, visible: true }));
}

function saveTldvFilterLayout(layout: TldvFilterLayoutItem[]) {
  try { localStorage.setItem(TLDV_FILTER_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

function loadCachedAiReport(meetingId: string, lang: string): string | null {
  try { return localStorage.getItem(`${AI_REPORT_CACHE_PREFIX}${lang}_${meetingId}`); } catch { return null; }
}

function saveCachedAiReport(meetingId: string, lang: string, report: string) {
  try { localStorage.setItem(`${AI_REPORT_CACHE_PREFIX}${lang}_${meetingId}`, report); } catch { /* ignore */ }
}

interface DemoListCache { dateFrom: string; dateTo: string; demos: DemoOrder[] }

function loadCachedDemoList(userId: string): DemoListCache | null {
  try {
    const raw = localStorage.getItem(`${DEMO_LIST_CACHE_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as DemoListCache) : null;
  } catch { return null; }
}

function saveCachedDemoList(userId: string, dateFrom: string, dateTo: string, demos: DemoOrder[]) {
  try { localStorage.setItem(`${DEMO_LIST_CACHE_PREFIX}${userId}`, JSON.stringify({ dateFrom, dateTo, demos })); } catch { /* ignore */ }
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDemoDate(raw: string): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return raw; }
}

function toTitleCase(str: string): string {
  return str.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function formatMql(raw: string): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase();
  if (lower.includes("yes") || lower === "1" || lower === "true" || lower === "si" || lower === "sí") return "MQL = Sí";
  if (lower.includes("no") || lower === "0" || lower === "false") return "MQL = No";
  return raw;
}

function cfCode(cf: Record<string, unknown> | undefined, key: string): string {
  const v = cf?.[key];
  if (!v) return "";
  if (typeof v === "object") {
    const obj = v as Record<string, string>;
    return obj["code"] ?? obj["name"] ?? "";
  }
  return String(v);
}

function orderToDemoOrder(order: RawOrder): DemoOrder | null {
  const tldvUrl = (order.customFields?.["record_of_meeting_demo"] as string) ?? "";
  if (!tldvUrl) return null;
  const demoDate = (order.customFields?.["demo_date"] as string) ?? "";
  if (!demoDate) return null;
  const valid = isValidTldvMeetingUrl(tldvUrl);
  const meetingId = valid ? extractMeetingId(tldvUrl) : `invalid_${order.id}`;
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";
  const managerSd = cfCode(order.customFields as Record<string, unknown> | undefined, "manager_sd");
  const managerSdRaw = order.customFields?.["manager_sd"];
  let managerSdLabel = managerSd;
  if (typeof managerSdRaw === "object" && managerSdRaw !== null) {
    const obj = managerSdRaw as Record<string, string>;
    managerSdLabel = toTitleCase(obj["name"] ?? obj["code"] ?? managerSd);
  }
  return {
    orderId: order.id,
    orderNumber: order.number,
    projectName: (order.customFields?.["name_komp_z"] as string) || "Proyecto sin nombre",
    managerSd,
    managerSdLabel,
    demoDate,
    tldvUrl,
    meetingId,
    invalidUrl: !valid,
    customerName: toTitleCase([firstName, lastName].filter(Boolean).join(" ")),
    crmField: "",
    mqlOrder: (order.customFields?.["mql_order"] as string) || "",
    statusCode: order.status || "",
  };
}

const SPEAKER_PALETTES = [
  { bubble: "bg-cyan-900/40",    name: "text-cyan-400",   align: "items-end"   },
  { bubble: "bg-gray-800",       name: "text-violet-400", align: "items-start" },
  { bubble: "bg-teal-900/40",    name: "text-teal-400",   align: "items-start" },
  { bubble: "bg-rose-950/40",    name: "text-rose-400",   align: "items-start" },
];

const DARK_INPUT = "border border-gray-700/60 rounded-md px-2.5 py-1.5 text-xs bg-gray-800/60 text-gray-300 focus:outline-none focus:border-cyan-600/60 transition-all";

// ── Structured AI data ────────────────────────────────────────────────────────
interface AiStructuredData {
  closingProbability: number;
  advisorChecklist: Array<{ criterion: string; passed: boolean; score?: number; notes?: string }>;
  errorMoments: Array<{ speaker: string; startTime: number | null; description: string; severity: "low" | "medium" | "high" }>;
}

function parseAiResponse(raw: string): { text: string; data: AiStructuredData | null } {
  const match = raw.match(/<STRUCTURED_DATA>([\s\S]*?)<\/STRUCTURED_DATA>/);
  if (!match) return { text: raw.trim(), data: null };
  const text = raw.replace(/<STRUCTURED_DATA>[\s\S]*?<\/STRUCTURED_DATA>/, "").trim();
  try {
    return { text, data: JSON.parse(match[1].trim()) as AiStructuredData };
  } catch {
    return { text, data: null };
  }
}

const STRUCTURED_SUFFIX = `

IMPORTANT: After your analysis, append this JSON block EXACTLY as shown (keep the XML tags unchanged):

<STRUCTURED_DATA>
{
  "closingProbability": <integer 0-100 estimating deal closing probability>,
  "advisorChecklist": [
    {"criterion": "<specific criterion>", "passed": <true|false>, "score": <integer 0-100>, "notes": "<brief explanation>"}
  ],
  "errorMoments": [
    {"speaker": "<speaker name exactly as in transcript>", "startTime": <number|null>, "description": "<what went wrong and why>", "severity": "<low|medium|high>"}
  ]
}
</STRUCTURED_DATA>

For advisorChecklist include 10-15 criteria: opening/introduction, needs discovery, active listening, product demo quality, objection handling, urgency creation, rapport building, closing technique, next steps agreed, professional language, solution fit, follow-up commitment. Each criterion must have a "score" field (integer 0-100).
For errorMoments list every advisor error or missed opportunity. Use the exact startTime from the transcript where available.
CRITICAL: ALL text values inside the JSON (criterion, notes, description) MUST be written in the same language as the rest of your response.`;

// Known criterion name translations (AI sometimes returns English keys regardless of language instruction)
const CRITERION_MAP: Record<string, Record<string, string>> = {
  "opening/introduction":  { es: "Apertura e introducción",       en: "Opening / Introduction",      ru: "Открытие / знакомство" },
  "needs discovery":       { es: "Descubrimiento de necesidades",  en: "Needs Discovery",             ru: "Выявление потребностей" },
  "active listening":      { es: "Escucha activa",                 en: "Active Listening",            ru: "Активное слушание" },
  "product demo quality":  { es: "Calidad de la demo",             en: "Product Demo Quality",        ru: "Качество демонстрации" },
  "objection handling":    { es: "Manejo de objeciones",           en: "Objection Handling",          ru: "Работа с возражениями" },
  "urgency creation":      { es: "Creación de urgencia",           en: "Urgency Creation",            ru: "Создание срочности" },
  "rapport building":      { es: "Construcción de rapport",        en: "Rapport Building",            ru: "Установление контакта" },
  "closing technique":     { es: "Técnica de cierre",              en: "Closing Technique",           ru: "Техника закрытия" },
  "next steps agreed":     { es: "Próximos pasos acordados",       en: "Next Steps Agreed",           ru: "Следующие шаги" },
  "professional language": { es: "Lenguaje profesional",           en: "Professional Language",       ru: "Профессиональный язык" },
  "solution fit":          { es: "Adecuación de la solución",      en: "Solution Fit",                ru: "Соответствие решения" },
  "follow-up commitment":  { es: "Compromiso de seguimiento",      en: "Follow-up Commitment",        ru: "Обязательство follow-up" },
};
function translateCriterion(criterion: string, lang: string): string {
  return CRITERION_MAP[criterion.toLowerCase().trim()]?.[lang] ?? criterion;
}

export function TLDV({ managerSdMap, statusLabels = {} }: Props) {
  const { user } = useAuth();
  const t = useT();
  const { lang } = useI18n();
  const { requestNavigate } = useNavigationGuard();

  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>([]);
  const [managerFilter, setManagerFilter] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [filterLayout, setFilterLayout] = useState<TldvFilterLayoutItem[]>(() => loadTldvFilterLayout());
  const [filterConfigOpen, setFilterConfigOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const dragFromIdx = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ page: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transcript" | "ai_report">("transcript");
  const [transcriptSubTab, setTranscriptSubTab] = useState<"chat" | "metrics">("chat");
  const [aiSubTab, setAiSubTab] = useState<"summary" | "analysis">("summary");

  const [transcript, setTranscript] = useState<TldvTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiStructuredData, setAiStructuredData] = useState<AiStructuredData | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  const tldvKeyRaw    = user?.tldvApiKey ?? "";
  const tldvIsEnabled = user?.tldvEnabled !== false;
  const tldvApiKey    = tldvIsEnabled ? tldvKeyRaw : "";
  const tldvIsDisabled = !!tldvKeyRaw && !tldvIsEnabled;

  const simlaKeyRaw    = user?.apiKey ?? "";
  const simlaIsEnabled = user?.apiKeyEnabled !== false;
  const simlaApiKey    = simlaIsEnabled ? simlaKeyRaw : "";
  const simlaIsDisabled = !!simlaKeyRaw && !simlaIsEnabled;

  const openaiKeyRaw    = user?.openaiApiKey ?? "";
  const openaiIsEnabled = user?.openaiEnabled !== false;
  const openaiApiKey    = openaiIsEnabled ? openaiKeyRaw : "";
  const openaiIsDisabled = !!openaiKeyRaw && !openaiIsEnabled;

  const openaiModel  = user?.openaiModel ?? DEFAULT_OPENAI_MODEL;
  const openaiPrompt = user?.tldvPrompt ?? user?.openaiPrompt ?? DEFAULT_AI_PROMPT;

  // Restore cached demo list on mount
  useEffect(() => {
    if (!user?.id) return;
    const cached = loadCachedDemoList(user.id);
    if (cached && cached.demos.length > 0) {
      setDateFrom(cached.dateFrom);
      setDateTo(cached.dateTo);
      applyDemos(cached.demos);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close gear dropdown on outside click
  useEffect(() => {
    if (!filterConfigOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setFilterConfigOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [filterConfigOpen]);

  function applyDemos(demos: DemoOrder[]) {
    setDemoOrders(demos);
  }

  async function handleLoadOrders() {
    if (!simlaApiKey) return;
    setLoading(true);
    setLoadError(null);
    setLoadProgress(null);
    setDemoOrders([]);
    setSelectedId(null);
    try {
      const raw = await fetchOrdersByDemoDate(
        simlaApiKey,
        dateFrom || undefined,
        dateTo || undefined,
        (page, total) => setLoadProgress({ page, total }),
      );
      const demos = raw.map(orderToDemoOrder).filter(Boolean) as DemoOrder[];
      applyDemos(demos);
      if (user?.id) saveCachedDemoList(user.id, dateFrom, dateTo, demos);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }

  useEffect(() => {
    const selected = demoOrders.find((d) => d.meetingId === selectedId);
    if (!selected || !tldvApiKey || selected.invalidUrl) return;
    setTranscript([]);
    setTranscriptError(null);
    setTranscriptLoading(true);
    fetchTldvTranscript(tldvApiKey, selected.meetingId)
      .then((segs) => setTranscript(segs))
      .catch((err) => setTranscriptError(err instanceof Error ? err.message : String(err)))
      .finally(() => setTranscriptLoading(false));
  }, [selectedId, tldvApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setAiReport(null); setAiStructuredData(null); return; }
    const raw = loadCachedAiReport(selectedId, lang);
    if (raw) {
      const { text, data } = parseAiResponse(raw);
      setAiReport(text);
      setAiStructuredData(data);
    } else {
      setAiReport(null);
      setAiStructuredData(null);
    }
    setAiReportError(null);
  }, [selectedId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateAiReport(forceRegenerate = false) {
    if (!selectedId || !openaiApiKey) return;
    if (!forceRegenerate) {
      const cached = loadCachedAiReport(selectedId, lang);
      if (cached) {
        const { text, data } = parseAiResponse(cached);
        setAiReport(text);
        setAiStructuredData(data);
        return;
      }
    }
    if (transcript.length === 0) { setAiReportError("no_transcript"); return; }
    setAiReportLoading(true);
    setAiReportError(null);
    try {
      const transcriptText = transcript
        .map((seg) => `[${seg.speaker}]: ${seg.text}`)
        .join("\n");
      const langNames: Record<string, string> = { es: "Spanish", en: "English", ru: "Russian" };
      const langInstruction = `\n\nIMPORTANT: Write your entire response in ${langNames[lang] ?? "Spanish"}.`;
      const raw = await callOpenAI(openaiApiKey, openaiModel, openaiPrompt + langInstruction + STRUCTURED_SUFFIX, transcriptText);
      const { text, data } = parseAiResponse(raw);
      setAiReport(text);
      setAiStructuredData(data);
      saveCachedAiReport(selectedId, lang, raw);
    } catch (err) {
      setAiReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiReportLoading(false);
    }
  }

  const selectedOrder = useMemo(
    () => demoOrders.find((d) => d.meetingId === selectedId) ?? null,
    [demoOrders, selectedId],
  );

  const filteredDemos = useMemo(() => {
    let list = managerFilter.length === 0 ? demoOrders : demoOrders.filter((d) => managerFilter.includes(d.managerSd));
    if (projectSearch.trim()) {
      const q = projectSearch.trim().toLowerCase();
      list = list.filter((d) => d.projectName.toLowerCase().includes(q));
    }
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      list = list.filter((d) => d.orderNumber.toLowerCase().includes(q));
    }
    return list;
  }, [demoOrders, managerFilter, projectSearch, orderSearch]);

  const filterLayoutVisibleCount = useMemo(
    () => filterLayout.filter((f) => f.visible).length,
    [filterLayout],
  );

  // Derived from demoOrders + managerSdMap so labels update when the API map loads
  const knownManagers = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of demoOrders) {
      if (d.managerSd && !map.has(d.managerSd)) {
        map.set(d.managerSd, managerSdMap[d.managerSd] || d.managerSdLabel || d.managerSd);
      }
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [demoOrders, managerSdMap]);

  // Map transcript segment indices that correspond to an AI error moment (fuzzy ±15s match)
  const errorSegmentSet = useMemo(() => {
    const set = new Map<number, string>(); // index → description
    if (!aiStructuredData?.errorMoments) return set;
    for (let i = 0; i < transcript.length; i++) {
      const seg = transcript[i];
      for (const e of aiStructuredData.errorMoments) {
        if (e.startTime != null && seg.startTime != null && Math.abs(seg.startTime - e.startTime) <= 15) {
          set.set(i, e.description);
          break;
        }
      }
    }
    return set;
  }, [transcript, aiStructuredData]);

  const speakerIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    let sidx = 0;
    for (const seg of transcript) {
      if (idx[seg.speaker] === undefined) idx[seg.speaker] = sidx++;
    }
    return idx;
  }, [transcript]);

  // Aggregate cached AI results for same manager across all loaded demos (≥2 needed to show)
  const managerPerformanceData = useMemo(() => {
    if (!selectedOrder) return null;
    const items: Array<{ label: string; probability: number; passRate: number; avgScore: number; isCurrent: boolean }> = [];
    const allSameManager = demoOrders.filter((d) => d.managerSd === selectedOrder.managerSd);
    for (const demo of allSameManager) {
      let data: AiStructuredData | null = null;
      if (demo.meetingId === selectedOrder.meetingId) {
        data = aiStructuredData;
      } else {
        const cached = loadCachedAiReport(demo.meetingId, lang);
        if (cached) ({ data } = parseAiResponse(cached));
      }
      if (!data) continue;
      const cl = data.advisorChecklist;
      const passRate = cl.length > 0 ? Math.round((cl.filter((c) => c.passed).length / cl.length) * 100) : 0;
      const avgScore = cl.length > 0 ? Math.round(cl.reduce((s, c) => s + (c.score ?? (c.passed ? 80 : 20)), 0) / cl.length) : 0;
      items.push({
        label: demo.projectName.length > 14 ? demo.projectName.slice(0, 12) + "…" : demo.projectName,
        probability: data.closingProbability,
        passRate,
        avgScore,
        isCurrent: demo.meetingId === selectedOrder.meetingId,
      });
    }
    return items.length >= 2 ? items : null;
  }, [selectedOrder, demoOrders, aiStructuredData, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-950">

      {/* ── Top filter bar ── */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-2 flex items-end gap-3 relative">

        {/* Icon + title */}
        <div className="flex items-center gap-2 shrink-0 pb-1">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
            <Video size={12} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide whitespace-nowrap">{t("tldv_title")}</span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-700 shrink-0 mb-1" />

        {/* Render filters in layout order */}
        {filterLayout.map((item) => {
          if (!item.visible) return null;
          if (item.id === "date") return (
            <div key="date" className="flex flex-col gap-0.5 shrink-0">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={9} className="shrink-0" />{t("filter_creation_date")}
              </p>
              <DateRangePicker
                compact
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
              />
            </div>
          );
          if (item.id === "manager" && knownManagers.length > 0) return (
            <div key="manager" className="flex flex-col gap-0.5 shrink-0">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                <User size={9} className="shrink-0" />{t("filter_manager")}
              </p>
              <div style={{ width: 160 }}>
                <MultiSelect variant="dark" options={knownManagers} selected={managerFilter} onChange={setManagerFilter} placeholder={t("filter_all")} />
              </div>
            </div>
          );
          if (item.id === "project") return (
            <div key="project" className="flex flex-col gap-0.5 shrink-0">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={9} className="shrink-0" />{t("tldv_filter_project")}
              </p>
              <div className="relative" style={{ width: 160 }}>
                <input type="text" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)}
                  className={DARK_INPUT + " w-full pr-6"} />
                {projectSearch && (
                  <button onClick={() => setProjectSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"><X size={11} /></button>
                )}
              </div>
            </div>
          );
          if (item.id === "order-num") return (
            <div key="order-num" className="flex flex-col gap-0.5 shrink-0">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                <Hash size={9} className="shrink-0" />{t("tldv_filter_order_num")}
              </p>
              <div className="relative" style={{ width: 160 }}>
                <input type="text" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
                  className={DARK_INPUT + " w-full pr-6"} />
                {orderSearch && (
                  <button onClick={() => setOrderSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"><X size={11} /></button>
                )}
              </div>
            </div>
          );
          return null;
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Errors */}
        {loadError && <p className="text-red-400 text-xs shrink-0 mb-1">{loadError}</p>}

        {/* Gear button + dropdown */}
        <div className="relative shrink-0 mb-0.5" ref={gearRef}>
          <button
            onClick={() => setFilterConfigOpen((v) => !v)}
            className={`p-1.5 rounded transition-colors ${filterConfigOpen ? "text-cyan-400 bg-gray-800" : "text-gray-600 hover:text-gray-400 hover:bg-gray-800"}`}
            title={t("filter_config_title")}
          >
            <Settings2 size={13} />
          </button>
          {filterConfigOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg p-3 w-56 shadow-xl">
              <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-2">{t("filter_config_title")}</p>
              {filterLayout.map((item, i) => {
                const def = TLDV_FILTER_DEFS.find((f) => f.id === item.id)!;
                const canHide = filterLayoutVisibleCount > 1 || !item.visible;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => { dragFromIdx.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = dragFromIdx.current;
                      if (from === null || from === i) return;
                      const next = [...filterLayout];
                      const [removed] = next.splice(from, 1);
                      next.splice(i, 0, removed);
                      setFilterLayout(next);
                      saveTldvFilterLayout(next);
                      dragFromIdx.current = null;
                    }}
                    className="flex items-center gap-2 py-1 cursor-grab active:cursor-grabbing select-none"
                  >
                    <GripVertical size={12} className="text-gray-600 shrink-0" />
                    <span className={`text-xs flex-1 ${item.visible ? "text-gray-300" : "text-gray-600"}`}>
                      {t(def.labelKey as Parameters<typeof t>[0])}
                    </span>
                    <button
                      disabled={!canHide}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = filterLayout.map((f, j) => j === i ? { ...f, visible: !f.visible } : f);
                        setFilterLayout(next);
                        saveTldvFilterLayout(next);
                      }}
                      className="p-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  const next = TLDV_FILTER_DEFS.map((f) => ({ id: f.id, visible: true }));
                  setFilterLayout(next);
                  saveTldvFilterLayout(next);
                }}
                className="text-[10px] text-cyan-500 hover:text-cyan-400 text-right mt-2 w-full transition-colors border-t border-gray-700 pt-2"
              >
                {t("filter_config_reset")}
              </button>
            </div>
          )}
        </div>

        {/* Load button */}
        <button
          onClick={handleLoadOrders}
          disabled={loading || !simlaApiKey}
          className="h-[30px] px-3 text-xs flex items-center gap-1.5 text-white font-semibold rounded-lg transition-all disabled:opacity-40 active:scale-[0.98] shrink-0 mb-0.5"
          style={{ background: loading ? "#1d4ed8" : "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)" }}
        >
          {loading ? (
            <><RefreshCw size={11} className="animate-spin" /> {t("tldv_loading_meetings")}</>
          ) : (
            <><Play size={11} fill="white" /> {t("tldv_load_meetings")}</>
          )}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel (meetings list only) ── */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-gray-800 bg-gray-900">

          {/* Order list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 flex flex-col gap-1.5">
            {filteredDemos.length === 0 && !loading && demoOrders.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700 select-none">
              <Video size={28} className="opacity-30" />
              <p className="text-xs">{t("tldv_no_meetings")}</p>
            </div>
          )}
          {filteredDemos.map((demo) => {
              const isSelected = demo.meetingId === selectedId;
              const managerName = (demo.managerSd ? (managerSdMap[demo.managerSd] || demo.managerSdLabel || demo.managerSd) : null);
              return (
                <button
                  key={demo.meetingId}
                  onClick={() => { setSelectedId(demo.meetingId); setActiveTab("transcript"); }}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? demo.invalidUrl
                        ? "bg-yellow-950/40 border-yellow-700/60 shadow-[0_0_14px_rgba(234,179,8,0.07)]"
                        : "bg-blue-950/60 border-cyan-700/50 shadow-[0_0_18px_rgba(6,182,212,0.09)]"
                      : "bg-gray-800/50 border-gray-700/40 hover:border-gray-600/70 hover:bg-gray-800/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={11} className="text-gray-600 shrink-0" />
                        <p className="text-sm font-semibold text-gray-100 truncate">{demo.projectName}</p>
                      </div>
                      <div className="flex items-center gap-2.5 flex-nowrap overflow-hidden">
                        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                          <Calendar size={10} className="text-gray-600" />
                          {formatDemoDate(demo.demoDate)}
                        </span>
                        {managerName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 truncate min-w-0">
                            <User size={10} className="text-gray-600 shrink-0" />
                            {managerName}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-600 shrink-0 ml-auto">
                          <Hash size={10} className="text-gray-700" />
                          {demo.orderNumber}
                        </span>
                      </div>
                      {demo.invalidUrl && (
                        <div className="flex items-center gap-1 bg-yellow-900/25 border border-yellow-700/35 rounded-md px-2 py-0.5 w-fit mt-0.5">
                          <AlertTriangle size={9} className="text-yellow-500 shrink-0" />
                          <span className="text-xs text-yellow-400 font-medium">{t("tldv_invalid_url")}</span>
                        </div>
                      )}
                    </div>
                    {demo.invalidUrl
                      ? <AlertTriangle size={13} className="text-yellow-500/70 shrink-0 mt-0.5" />
                      : <Video size={12} className={`shrink-0 mt-0.5 transition-colors ${isSelected ? "text-cyan-400" : "text-gray-700"}`} />
                    }
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sticky count footer */}
          {demoOrders.length > 0 && (
            <div className="shrink-0 px-4 py-2 border-t border-gray-800/60 bg-gray-900/80">
              <span className="text-[10px] text-gray-600">
                Total demos encontradas:{" "}
                <span className="text-gray-400 font-semibold">{filteredDemos.length}</span>
                {demoOrders.length !== filteredDemos.length && (
                  <span className="text-gray-700"> / {demoOrders.length}</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#0c0e14" }}>
          {loading ? (
            <SearchAnimation page={loadProgress?.page ?? 0} total={loadProgress?.total ?? 0} />
          ) : !selectedOrder ? (
            !tldvApiKey
              ? <IntegrationDisabledState type="tldv" isDisabled={tldvIsDisabled} />
              : !simlaApiKey
                ? <IntegrationDisabledState type="crm" isDisabled={simlaIsDisabled} />
                : <EmptyState />
          ) : (
            <>
              {/* Header */}
              <div className="shrink-0 px-6 pt-5 pb-0 bg-gray-900/70 border-b border-gray-800 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4 pb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white truncate">{selectedOrder.projectName}</h3>
                      {selectedOrder.invalidUrl && (
                        <span className="flex items-center gap-1 bg-yellow-900/35 border border-yellow-700/45 text-yellow-400 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                          <AlertTriangle size={10} />
                          {t("tldv_requires_review")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {selectedOrder.customerName && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <UserCircle size={12} className="text-gray-500 shrink-0" />
                          <span className="text-gray-600">{t("tldv_customer_label")}</span> {selectedOrder.customerName}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Calendar size={11} className="text-gray-600 shrink-0" />
                        <span className="text-gray-600">{t("tldv_demo_date")}</span> {formatDemoDate(selectedOrder.demoDate)}
                      </span>
                      {selectedOrder.mqlOrder && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Tag size={11} className="text-gray-600 shrink-0" />
                          <span className="text-gray-600">MQL:</span> {formatMql(selectedOrder.mqlOrder).replace("MQL = ", "")}
                        </span>
                      )}
                      {selectedOrder.statusCode && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <CircleDot size={11} className="text-gray-600 shrink-0" />
                          <span className="text-gray-600">{t("tldv_status_label")}</span> {statusLabels[selectedOrder.statusCode] || selectedOrder.statusCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <a href={`https://base.simla.com/orders/${selectedOrder.orderId}/edit`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-800"
                    >
                      <ExternalLink size={12} /> {t("tldv_open_crm")}
                    </a>
                    {!selectedOrder.invalidUrl && (
                      <a href={tldvMeetingUrl(selectedOrder.meetingId)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-800"
                      >
                        <Video size={12} /> TLDV
                      </a>
                    )}
                  </div>
                </div>

                {/* Underline tabs */}
                {!selectedOrder.invalidUrl && (
                  <div className="flex">
                    {(["transcript", "ai_report"] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                          activeTab === tab
                            ? "border-cyan-500 text-cyan-400"
                            : "border-transparent text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {tab === "ai_report" && <Bot size={13} />}
                        {tab === "transcript" ? t("tldv_tab_transcript") : t("tldv_ai_report_tab")}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                {/* Invalid URL warning panel */}
                {selectedOrder.invalidUrl && (
                  <div className="relative flex-1 min-h-0">
                  <div className="absolute inset-0 overflow-y-auto p-6">
                    <div className="bg-yellow-950/25 border border-yellow-800/40 rounded-2xl p-6 flex flex-col gap-3.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-yellow-500 shrink-0" />
                        <p className="text-yellow-300 font-semibold text-sm">Enlace de grabación inválido</p>
                      </div>
                      <p className="text-yellow-400/70 text-sm leading-relaxed">
                        El vendedor registró un enlace que no corresponde a una reunión de TLDV.
                        Revisa el pedido y corrige el campo{" "}
                        <span className="font-mono text-yellow-300 bg-yellow-950/50 px-1 py-0.5 rounded">record_of_meeting_demo</span>.
                      </p>
                      <div className="bg-black/30 border border-yellow-900/30 rounded-xl px-4 py-2.5">
                        <p className="text-xs text-yellow-700 font-mono break-all">{selectedOrder.tldvUrl}</p>
                      </div>
                      <p className="text-xs text-gray-600">
                        Formato válido:{" "}
                        <span className="font-mono text-gray-500">https://tldv.io/app/meetings/&lt;id&gt;</span>
                      </p>
                    </div>
                  </div>
                  </div>
                )}

                {/* Transcript tab */}
                {!selectedOrder.invalidUrl && activeTab === "transcript" && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    {/* Sub-tab bar */}
                    {transcript.length > 0 && (
                      <div className="shrink-0 flex gap-0.5 px-6 border-b border-gray-800/60 bg-gray-900/40">
                        {(["chat", "metrics"] as const).map((sub) => (
                          <button key={sub} onClick={() => setTranscriptSubTab(sub)}
                            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                              transcriptSubTab === sub
                                ? "border-violet-500 text-violet-400"
                                : "border-transparent text-gray-600 hover:text-gray-400"
                            }`}
                          >
                            {sub === "chat" ? t("tldv_tab_chat") : t("tldv_tab_metrics")}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Chat sub-tab */}
                    {(transcriptSubTab === "chat" || transcript.length === 0) && (
                      <div className="relative flex-1 min-h-0">
                      <div className="absolute inset-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                        {transcriptLoading && <TranscriptSkeleton />}
                        {transcriptError && <p className="text-red-400 text-sm">{transcriptError}</p>}
                        {!transcriptLoading && !transcriptError && transcript.length === 0 && (
                          <p className="text-gray-700 text-sm">{t("tldv_no_transcript")}</p>
                        )}
                        {transcript.map((seg, i) => {
                          const idx = speakerIndex[seg.speaker] ?? 0;
                          const palette = SPEAKER_PALETTES[idx % SPEAKER_PALETTES.length];
                          const ts = seg.startTime != null ? fmtTime(seg.startTime) : null;
                          const prevSeg = i > 0 ? transcript[i - 1] : null;
                          const showSpeaker = !prevSeg || prevSeg.speaker !== seg.speaker;
                          const isRight = idx === 0;
                          const errorDesc = errorSegmentSet.get(i);
                          return (
                            <div key={i} className={`flex flex-col gap-0.5 ${palette.align}`}>
                              {showSpeaker && (
                                <p className={`text-[10px] font-semibold px-1 ${palette.name}`}>{seg.speaker}</p>
                              )}
                              <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${palette.bubble} ${isRight ? "rounded-tr-sm" : "rounded-tl-sm"} ${errorDesc ? "ring-1 ring-red-500/60" : ""}`}>
                                <p className="text-sm text-gray-200 leading-relaxed">{seg.text}</p>
                                <div className="flex items-end justify-between gap-2 mt-1.5">
                                  {ts && <p className="text-[10px] text-gray-600 tabular-nums font-mono">{ts}</p>}
                                  {errorDesc && (
                                    <div className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                                      <AlertTriangle size={9} />
                                      <span className="italic leading-snug max-w-[280px]">{errorDesc}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    )}
                    {/* Metrics sub-tab */}
                    {transcriptSubTab === "metrics" && transcript.length > 0 && (
                      <div className="relative flex-1 min-h-0">
                        <div className="absolute inset-0 overflow-y-auto px-5 py-4">
                          <CallMetricsPanel segments={transcript} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Analysis */}
                {!selectedOrder.invalidUrl && activeTab === "ai_report" && (
                  <div className="flex-1 min-h-0 flex flex-col">

                    {/* Sticky header: model bar + sub-tabs */}
                    <div className="shrink-0 px-6 pt-3 border-b border-gray-800/60 bg-gray-900/40">
                      <div className="flex items-center justify-between gap-2 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Bot size={13} className="text-violet-400" />
                          <span className="text-xs text-gray-500">
                            <span className="text-gray-600">{t("tldv_model_used")}</span> {openaiModel}
                          </span>
                          <button
                            onClick={() => requestNavigate("/admin?tab=integraciones")}
                            title={t("tldv_configure_settings")}
                            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-violet-400 transition-colors p-0.5 rounded hover:bg-gray-800"
                          >
                            <Settings2 size={12} />
                          </button>
                        </div>
                        {aiReport !== null && !aiReportLoading && openaiApiKey && (
                          <button
                            onClick={() => handleGenerateAiReport(true)}
                            className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-violet-400 transition-colors"
                          >
                            <RefreshCw size={11} /> {t("tldv_ai_regenerate")}
                          </button>
                        )}
                      </div>
                      {/* Sub-tabs row — only when report exists */}
                      {!aiReportLoading && aiReport !== null && openaiApiKey && aiStructuredData && (
                        <div className="flex gap-0.5">
                          {(["summary", "analysis"] as const).map((sub) => (
                            <button key={sub} onClick={() => setAiSubTab(sub)}
                              className={`px-3 pb-2 text-xs font-medium border-b-2 transition-colors ${
                                aiSubTab === sub
                                  ? "border-violet-500 text-violet-400"
                                  : "border-transparent text-gray-600 hover:text-gray-400"
                              }`}
                            >
                              {sub === "summary" ? t("tldv_ai_tab_summary") : t("tldv_ai_tab_analysis")}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Scrollable content */}
                    <div className="relative flex-1 min-h-0">
                    <div className="absolute inset-0 overflow-y-auto p-6 flex flex-col gap-4">
                      {/* No API key / disabled */}
                      {!openaiApiKey && (
                        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${
                            openaiIsDisabled
                              ? "bg-orange-950/30 border-orange-800/40"
                              : "bg-gray-800/50 border-gray-700/50"
                          }`}>
                            <Bot size={26} className={openaiIsDisabled ? "text-orange-400/70" : "text-violet-400/60"} />
                          </div>
                          <p className={`text-sm max-w-xs ${openaiIsDisabled ? "text-orange-400/80" : "text-gray-400"}`}>
                            {openaiIsDisabled ? t("tldv_ai_disabled") : t("tldv_ai_no_key")}
                          </p>
                        </div>
                      )}

                      {/* Has API key but no report yet */}
                      {openaiApiKey && !aiReportLoading && aiReport === null && (
                        <div className="flex flex-col items-center justify-center gap-5 py-16">
                          <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                            <Bot size={26} className="text-violet-400/60" />
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 font-semibold mb-1">{t("tldv_ai_report_tab")}</p>
                            <p className="text-gray-600 text-sm mb-5 max-w-xs">
                              {transcript.length === 0 ? t("tldv_ai_no_transcript") : t("tldv_ai_ready")}
                            </p>
                            <button
                              onClick={() => handleGenerateAiReport(false)}
                              disabled={transcript.length === 0}
                              className="flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl text-sm mx-auto hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-40"
                              style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
                            >
                              <Bot size={14} /> {t("tldv_ai_generate")}
                            </button>
                          </div>
                          {aiReportError && aiReportError !== "no_transcript" && (
                            <p className="text-red-400 text-sm">{aiReportError}</p>
                          )}
                        </div>
                      )}

                      {/* Loading */}
                      {aiReportLoading && <AiLoadingAnimation />}

                      {/* Report rendered */}
                      {!aiReportLoading && aiReport !== null && openaiApiKey && (
                        <>
                          {/* Summary sub-tab (or full view when no structured data) */}
                          {(!aiStructuredData || aiSubTab === "summary") && (
                            <AiReportRenderer text={aiReport} />
                          )}
                          {/* Evaluation sub-tab */}
                          {aiStructuredData && aiSubTab === "analysis" && (
                            <>
                              <ProbabilityCard probability={aiStructuredData.closingProbability} />
                              {aiStructuredData.advisorChecklist.length > 0 && (
                                <AdvisorChecklist items={aiStructuredData.advisorChecklist} lang={lang} />
                              )}
                              {aiStructuredData.errorMoments.length > 0 && (
                                <ErrorMomentsList moments={aiStructuredData.errorMoments} />
                              )}
                              {managerPerformanceData && (
                                <ManagerPerformanceChart data={managerPerformanceData} managerName={managerSdMap[selectedOrder.managerSd] || selectedOrder.managerSdLabel} />
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Call metrics panel ───────────────────────────────────────────────────────
const CHART_COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

interface SpeakerStats {
  name: string;
  turns: number;
  words: number;
  questions: number;
  avgTurnWords: number;
  maxTurnWords: number;
  wordsPerMin: number | null;
}

function computeSpeakerStats(segments: TldvTranscriptSegment[]): SpeakerStats[] {
  const map = new Map<string, { turns: number; words: number; questions: number; maxTurnWords: number }>();
  for (const seg of segments) {
    if (!map.has(seg.speaker)) map.set(seg.speaker, { turns: 0, words: 0, questions: 0, maxTurnWords: 0 });
    const e = map.get(seg.speaker)!;
    e.turns++;
    const w = seg.text.split(/\s+/).filter(Boolean).length;
    e.words += w;
    e.questions += (seg.text.match(/\?/g) ?? []).length;
    if (w > e.maxTurnWords) e.maxTurnWords = w;
  }
  const duration = segments[segments.length - 1]?.startTime ?? null;
  return Array.from(map.entries())
    .map(([name, d]) => ({
      name,
      ...d,
      avgTurnWords: d.turns > 0 ? Math.round(d.words / d.turns) : 0,
      wordsPerMin: duration != null && duration > 0 ? Math.round((d.words / duration) * 60) : null,
    }))
    .sort((a, b) => b.words - a.words);
}

function buildTalkTimeline(segments: TldvTranscriptSegment[]): { speaker: string; start: number; end: number }[] | null {
  if (segments.length < 2 || segments[0].startTime == null) return null;
  const result: { speaker: string; start: number; end: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const nextStart = segments[i + 1]?.startTime ?? (s.startTime! + 30);
    if (s.startTime == null) continue;
    result.push({ speaker: s.speaker, start: s.startTime, end: nextStart });
  }
  return result;
}

function CallMetricsPanel({ segments }: { segments: TldvTranscriptSegment[] }) {
  const t = useT();
  const stats = useMemo(() => computeSpeakerStats(segments), [segments]);
  const timeline = useMemo(() => buildTalkTimeline(segments), [segments]);
  const totalWords = stats.reduce((s, sp) => s + sp.words, 0);
  const totalTurns = stats.reduce((s, sp) => s + sp.turns, 0);
  const totalQuestions = stats.reduce((s, sp) => s + sp.questions, 0);

  const clientWords = stats.slice(1).reduce((s, sp) => s + sp.words, 0);
  const engagement = totalWords > 0 ? Math.round((clientWords / totalWords) * 100) : 0;
  const engagementLabel = engagement >= 50 ? t("tldv_metrics_engagement_high") : engagement >= 30 ? t("tldv_metrics_engagement_med") : t("tldv_metrics_engagement_low");
  const engagementColor = engagement >= 50 ? "#10b981" : engagement >= 30 ? "#f59e0b" : "#ef4444";

  const duration = segments[segments.length - 1]?.startTime;
  const totalWordsPerMin = duration != null && duration > 0 ? Math.round((totalWords / duration) * 60) : null;

  // Word distribution bar chart
  const wordChartOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      textStyle: { color: "#d1d5db", fontSize: 11 },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0];
        const pct = totalWords > 0 ? Math.round((p.value / totalWords) * 100) : 0;
        return `${p.name}<br/>${p.value.toLocaleString()} ${t("tldv_metrics_words_abbr")} (${pct}%)`;
      },
    },
    grid: { left: 0, right: 20, top: 6, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#1f2937" } },
      axisLabel: { color: "#4b5563", fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: stats.map((s) => s.name),
      axisLabel: { color: "#9ca3af", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: "bar",
      data: stats.map((s, i) => ({
        value: s.words,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 22,
    }],
  };

  // Talk speed chart
  const speedChartOption = totalWordsPerMin != null ? {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      textStyle: { color: "#d1d5db", fontSize: 11 },
    },
    grid: { left: 0, right: 20, top: 6, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#1f2937" } },
      axisLabel: { color: "#4b5563", fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: stats.map((s) => s.name),
      axisLabel: { color: "#9ca3af", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: "bar",
      data: stats.map((s, i) => ({
        value: s.wordsPerMin ?? 0,
        itemStyle: { color: CHART_COLORS[(i + 2) % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 22,
    }],
  } : null;

  // Timeline scatter chart
  const speakers = stats.map((s) => s.name);
  const timelineChartOption = timeline && duration != null ? {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      textStyle: { color: "#d1d5db", fontSize: 11 },
      formatter: (p: { name: string; value: number[] }) => `${p.name}<br/>${fmtTime(p.value[0])} → ${fmtTime(p.value[1])}`,
    },
    grid: { left: 0, right: 10, top: 6, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      max: duration,
      splitLine: { show: false },
      axisLabel: { color: "#4b5563", fontSize: 9, formatter: (v: number) => fmtTime(v) },
    },
    yAxis: {
      type: "category",
      data: speakers,
      axisLabel: { color: "#9ca3af", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: speakers.map((sp, si) => ({
      type: "custom",
      name: sp,
      renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[]; style: () => unknown }) => {
        const start = api.coord([api.value(0), si]);
        const end = api.coord([api.value(1), si]);
        const height = api.size([0, 1])[1] * 0.6;
        return {
          type: "rect",
          shape: { x: start[0], y: start[1] - height / 2, width: Math.max(end[0] - start[0], 2), height },
          style: { fill: CHART_COLORS[si % CHART_COLORS.length], opacity: 0.8 },
        };
      },
      data: timeline.filter((seg) => seg.speaker === sp).map((seg) => ({
        name: sp,
        value: [seg.start, seg.end, si],
        itemStyle: { color: CHART_COLORS[si % CHART_COLORS.length] },
      })),
      encode: { x: [0, 1], y: 2 },
    })),
  } : null;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { icon: <MessageSquare size={12} />, label: t("tldv_metrics_participants"), value: stats.length, color: "text-cyan-400" },
          { icon: <Clock size={12} />, label: t("tldv_metrics_duration"), value: duration != null ? fmtTime(duration) : "—", color: "text-violet-400" },
          { icon: <RefreshCw size={12} />, label: t("tldv_metrics_turns"), value: totalTurns, color: "text-teal-400" },
          { icon: <HelpCircle size={12} />, label: t("tldv_metrics_questions"), value: totalQuestions, color: "text-amber-400" },
        ] as const).map(({ icon, label, value, color }) => (
          <div key={label} className="flex flex-col gap-1 bg-gray-900/50 rounded-lg px-3 py-2.5 border border-gray-700/30">
            <div className={`flex items-center gap-1 ${color}`}>{icon}<span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span></div>
            <p className="text-base font-bold text-gray-100">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Word distribution */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
          <span className="w-1 h-4 rounded-full bg-cyan-500 shrink-0" />
          <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_metrics_words")}</p>
          <span className="text-[10px] text-gray-600 ml-auto">{totalWords.toLocaleString()} {t("tldv_metrics_total_words")}</span>
        </div>
        <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
          <ReactECharts option={wordChartOption} style={{ height: Math.max(60, stats.length * 32) }} notMerge />
          <div className="flex flex-col gap-1.5">
            {stats.map((sp, i) => {
              const pct = totalWords > 0 ? Math.round((sp.words / totalWords) * 100) : 0;
              return (
                <div key={sp.name} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-gray-300 w-28 truncate">{sp.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-700/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                  <span className="text-gray-500 w-8 text-right">{pct}%</span>
                  <span className="text-gray-700 w-16 text-right">{sp.words.toLocaleString()} {t("tldv_metrics_words_abbr")}</span>
                  <span className="text-gray-700 w-16 text-right">{sp.turns} {t("tldv_metrics_turns_abbr")}</span>
                  {sp.questions > 0 && <span className="text-amber-600 text-[10px]">{sp.questions}?</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-speaker detail table */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
          <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
          <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_metrics_detail")}</p>
        </div>
        <div className="px-4 py-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-600 uppercase tracking-wider">
                <th className="text-left pb-2 font-semibold">{t("tldv_metrics_participants")}</th>
                <th className="text-right pb-2 font-semibold">{t("tldv_metrics_words")}</th>
                <th className="text-right pb-2 font-semibold">{t("tldv_metrics_turns_abbr")}</th>
                <th className="text-right pb-2 font-semibold">{t("tldv_metrics_avg_turn")}</th>
                <th className="text-right pb-2 font-semibold">{t("tldv_metrics_longest")}</th>
                {totalWordsPerMin != null && <th className="text-right pb-2 font-semibold">{t("tldv_metrics_talk_speed")}</th>}
                <th className="text-right pb-2 font-semibold">?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/20">
              {stats.map((sp, i) => (
                <tr key={sp.name}>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-300 truncate max-w-[100px]">{sp.name}</span>
                  </td>
                  <td className="py-1.5 text-right text-gray-400">{sp.words.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-gray-400">{sp.turns}</td>
                  <td className="py-1.5 text-right text-gray-500">{sp.avgTurnWords} {t("tldv_metrics_words_abbr")}</td>
                  <td className="py-1.5 text-right text-gray-500">{sp.maxTurnWords} {t("tldv_metrics_words_abbr")}</td>
                  {totalWordsPerMin != null && <td className="py-1.5 text-right text-gray-500">{sp.wordsPerMin ?? "—"}</td>}
                  <td className="py-1.5 text-right text-amber-600">{sp.questions > 0 ? sp.questions : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Talk speed chart */}
      {speedChartOption && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
            <span className="w-1 h-4 rounded-full bg-teal-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_metrics_talk_speed")}</p>
            <span className="text-[10px] text-gray-600 ml-auto">{totalWordsPerMin} {t("tldv_metrics_words_abbr")}/min total</span>
          </div>
          <div className="px-4 pt-3 pb-4">
            <ReactECharts option={speedChartOption} style={{ height: Math.max(60, stats.length * 32) }} notMerge />
          </div>
        </div>
      )}

      {/* Talk timeline */}
      {timelineChartOption && duration != null && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
            <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_metrics_talk_ratio")}</p>
          </div>
          <div className="px-4 pt-3 pb-4">
            <ReactECharts option={timelineChartOption} style={{ height: Math.max(80, speakers.length * 36) }} notMerge />
          </div>
        </div>
      )}

      {/* Engagement */}
      {stats.length >= 2 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{t("tldv_metrics_engagement")}</p>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-1.5 bg-gray-700/40 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${engagement}%`, backgroundColor: engagementColor }} />
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: engagementColor }}>{engagement}% — {engagementLabel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Probability card ──────────────────────────────────────────────────────────
function ProbabilityCard({ probability }: { probability: number }) {
  const t = useT();
  const label = probability >= 75 ? t("tldv_probability_very_high")
    : probability >= 55 ? t("tldv_probability_high")
    : probability >= 35 ? t("tldv_probability_med")
    : t("tldv_probability_low");
  const color = probability >= 75 ? "#10b981"
    : probability >= 55 ? "#3b82f6"
    : probability >= 35 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <span className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_probability_title")}</p>
      </div>
      <div className="px-4 py-4 flex items-center gap-5">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1f2937" strokeWidth="6" />
            <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={2 * Math.PI * 22}
              strokeDashoffset={2 * Math.PI * 22 * (1 - probability / 100)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{probability}%</span>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color }}>{label}</p>
          <div className="w-48 h-2 bg-gray-700/40 rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${probability}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Advisor checklist ─────────────────────────────────────────────────────────
function AdvisorChecklist({ items, lang }: { items: AiStructuredData["advisorChecklist"]; lang: string }) {
  const t = useT();
  const passed = items.filter((i) => i.passed).length;
  const avgScore = items.length > 0 ? Math.round(items.reduce((s, c) => s + (c.score ?? (c.passed ? 80 : 20)), 0) / items.length) : 0;
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
          <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_checklist_title")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{passed}/{items.length}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: avgScore >= 70 ? "#10b981" : avgScore >= 40 ? "#f59e0b" : "#ef4444", backgroundColor: `${avgScore >= 70 ? "#10b981" : avgScore >= 40 ? "#f59e0b" : "#ef4444"}18` }}>{avgScore}%</span>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        {items.map((item, i) => {
          const score = item.score ?? (item.passed ? 80 : 20);
          // Color: green if passed, amber if partially (not passed but score≥40), red if failed (score<40)
          const barColor = item.passed ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
          const statusLabel = item.passed ? t("tldv_checklist_passed") : score >= 40 ? t("tldv_checklist_partial") : t("tldv_checklist_failed");
          const statusColor = item.passed ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                item.passed ? "bg-emerald-900/50 text-emerald-400" : score >= 40 ? "bg-amber-900/40 text-amber-400" : "bg-red-900/40 text-red-400"
              }`}>
                {item.passed ? "✓" : score >= 40 ? "~" : "✗"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className={`text-xs ${item.passed ? "text-gray-300" : score >= 40 ? "text-gray-400" : "text-gray-500"}`}>
                    {translateCriterion(item.criterion, lang)}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] ${statusColor}`}>{statusLabel}</span>
                    <span className="text-[10px] font-semibold" style={{ color: barColor }}>{score}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-700/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: barColor }} />
                </div>
                {item.notes && <p className="text-[10px] text-gray-600 mt-0.5 italic">{item.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Error moments list ────────────────────────────────────────────────────────
function ErrorMomentsList({ moments }: { moments: AiStructuredData["errorMoments"] }) {
  const t = useT();
  const severityConfig = {
    high:   { label: t("tldv_errors_severity_high"), color: "#ef4444", bg: "bg-red-950/40 border-red-800/40" },
    medium: { label: t("tldv_errors_severity_med"),  color: "#f59e0b", bg: "bg-amber-950/40 border-amber-800/40" },
    low:    { label: t("tldv_errors_severity_low"),  color: "#6b7280", bg: "bg-gray-800/60 border-gray-700/40" },
  };
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <span className="w-1 h-4 rounded-full bg-red-500 shrink-0" />
        <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_errors_title")}</p>
        <span className="text-[10px] text-gray-500 ml-auto">{moments.length}</span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        {moments.map((e, i) => {
          const cfg = severityConfig[e.severity] ?? severityConfig.low;
          return (
            <div key={i} className={`flex gap-3 rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <AlertTriangle size={13} style={{ color: cfg.color }} />
                {e.startTime != null && (
                  <span className="text-[9px] font-mono text-gray-600">{fmtTime(e.startTime)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 truncate">{e.speaker}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: `${cfg.color}18` }}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-snug">{e.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Manager performance chart ─────────────────────────────────────────────────
function ManagerPerformanceChart({ data, managerName }: { data: Array<{ label: string; probability: number; passRate: number; avgScore: number; isCurrent: boolean }>; managerName: string }) {
  const t = useT();
  const chartOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      textStyle: { color: "#d1d5db", fontSize: 11 },
    },
    legend: {
      data: [t("tldv_manager_perf_probability"), t("tldv_manager_perf_pass_rate"), t("tldv_manager_perf_avg_score")],
      textStyle: { color: "#6b7280", fontSize: 10 },
      bottom: 0,
    },
    grid: { left: 0, right: 10, top: 8, bottom: 30, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLabel: { color: "#6b7280", fontSize: 10, rotate: data.length > 4 ? 30 : 0 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#1f2937" } },
      axisLabel: { color: "#4b5563", fontSize: 10, formatter: (v: number) => `${v}%` },
    },
    series: [
      {
        name: t("tldv_manager_perf_probability"),
        type: "bar",
        barMaxWidth: 18,
        data: data.map((d) => ({
          value: d.probability,
          itemStyle: { color: d.isCurrent ? "#8b5cf6" : "#8b5cf680", borderRadius: [3, 3, 0, 0] },
        })),
      },
      {
        name: t("tldv_manager_perf_pass_rate"),
        type: "bar",
        barMaxWidth: 18,
        data: data.map((d) => ({
          value: d.passRate,
          itemStyle: { color: d.isCurrent ? "#06b6d4" : "#06b6d480", borderRadius: [3, 3, 0, 0] },
        })),
      },
      {
        name: t("tldv_manager_perf_avg_score"),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#10b981", width: 2 },
        itemStyle: { color: "#10b981" },
        data: data.map((d) => d.avgScore),
      },
    ],
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
        <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{t("tldv_manager_perf_title")}</p>
        <span className="text-[10px] text-gray-500 ml-auto">{managerName}</span>
      </div>
      <div className="px-4 pt-3 pb-4">
        <ReactECharts option={chartOption} style={{ height: 200 }} notMerge />
        <p className="text-[10px] text-gray-700 text-center mt-1">
          {data.find(d => d.isCurrent)?.label && "▮ demo actual"}
        </p>
      </div>
    </div>
  );
}

// ── AI loading animation ─────────────────────────────────────────────────────
const AI_STEPS = [
  "tldv_ai_step_reading",
  "tldv_ai_step_keywords",
  "tldv_ai_step_scoring",
  "tldv_ai_step_writing",
] as const;

function AiLoadingAnimation() {
  const [step, setStep] = useState(0);
  const t = useT();

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % AI_STEPS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-14 select-none">
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.5; }
          50%       { transform: translateY(-6px); opacity: 1;   }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
      {/* Animated rings + icon */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <span className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-[ping_2s_ease-in-out_infinite]" />
        <span className="absolute inset-2 rounded-full border border-violet-400/30 animate-[ping_2s_ease-in-out_0.5s_infinite]" />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c3aed22,#6366f133)" }}>
          <Bot size={26} className="text-violet-400" />
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </div>
      </div>

      {/* Cycling step text */}
      <div className="text-center min-h-[2.5rem]">
        <p key={step} className="text-gray-300 text-sm font-medium animate-[fadeIn_0.4s_ease]">
          {t(AI_STEPS[step] as Parameters<typeof t>[0])}
        </p>
        <p className="text-gray-600 text-xs mt-1">{t("tldv_ai_step_writing")}…</p>
      </div>

      {/* Three bouncing dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-violet-500"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── AI Report renderer ────────────────────────────────────────────────────────
function AiReportRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const sections: { heading: string | null; lines: string[] }[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      if (current.heading !== null || current.lines.some((l) => l.trim())) {
        sections.push(current);
      }
      current = { heading: line.replace(/^#+\s/, ""), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.heading !== null || current.lines.some((l) => l.trim())) sections.push(current);

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {sections.map((sec, si) => (
        <div key={si} className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
          {sec.heading && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
              <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
              <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{sec.heading}</p>
            </div>
          )}
          <div className="px-4 py-3 flex flex-col gap-1">
            {sec.lines.map((line, i) => {
              if (!line.trim()) return null;
              if (line.startsWith("- ") || line.startsWith("* "))
                return (
                  <div key={i} className="flex gap-2 text-gray-300">
                    <span className="text-violet-400 shrink-0 mt-[3px] text-[10px]">▸</span>
                    <span>{formatInline(line.slice(2))}</span>
                  </div>
                );
              if (/^\d+\.\s/.test(line)) {
                const match = line.match(/^(\d+)\.\s(.+)/);
                if (match)
                  return (
                    <div key={i} className="flex gap-2 text-gray-300">
                      <span className="text-violet-400 shrink-0 font-mono text-[10px] mt-[3px] w-4 text-right">{match[1]}.</span>
                      <span>{formatInline(match[2])}</span>
                    </div>
                  );
              }
              return <p key={i} className="text-gray-300">{formatInline(line)}</p>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-gray-100 font-semibold">{part.slice(2, -2)}</strong>
      : part
  );
}

// ── Integration disabled / missing state ─────────────────────────────────────
function IntegrationDisabledState({ type, isDisabled }: { type: "tldv" | "crm"; isDisabled: boolean }) {
  const t = useT();
  const { requestNavigate } = useNavigationGuard();

  let message: string;
  if (type === "tldv") {
    message = isDisabled ? t("tldv_tldv_disabled") : t("tldv_not_configured");
  } else {
    message = isDisabled ? t("tldv_simla_disabled") : t("tldv_simla_missing");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none">
      <div className="relative flex items-center justify-center w-32 h-32">
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute rounded-full border border-orange-500/25"
            style={{ width: 56, height: 56, animation: `oPulse 2.4s ease-out ${i * 0.8}s infinite` }} />
        ))}
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center z-10"
          style={{ background: "linear-gradient(135deg,#7c2d12 0%,#c2410c 100%)",
            boxShadow: "0 0 28px rgba(234,88,12,0.3)", animation: "oFloat 3s ease-in-out infinite" }}>
          <AlertTriangle size={24} className="text-orange-200" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-orange-200 font-semibold text-base mb-2">{t("integration_disabled_title")}</p>
        <p className="text-orange-400/75 text-sm max-w-xs leading-relaxed">
          {message}
        </p>
      </div>
      <button
        onClick={() => requestNavigate("/admin?tab=integraciones")}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-700/50 bg-orange-950/40 text-orange-300 text-sm font-medium hover:bg-orange-950/60 transition-colors"
      >
        <Settings2 size={14} /> {t("go_to_settings")}
      </button>
    </div>
  );
}

// ── Empty state (no meeting selected) ───────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none">
      <style>{`
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.18; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes dotBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
        @keyframes textFade {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* Pulsing rings + floating icon */}
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Rings */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-cyan-500/25"
            style={{
              width: 56, height: 56,
              animation: `ringPulse 2.4s ease-out ${i * 0.8}s infinite`,
            }}
          />
        ))}

        {/* Central icon container */}
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center z-10"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(59,130,246,0.12))",
            border: "1px solid rgba(6,182,212,0.25)",
            animation: "iconFloat 3.2s ease-in-out infinite",
          }}
        >
          <Video size={24} className="text-cyan-500/60" />
          {/* Blinking REC dot */}
          <div
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500/80"
            style={{ animation: "dotBlink 1.8s ease-in-out infinite" }}
          />
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-1.5">
        <p
          className="text-sm font-semibold text-gray-400"
          style={{ animation: "textFade 3s ease-in-out infinite" }}
        >
          Selecciona una reunión
        </p>
        <p className="text-xs text-gray-700">para ver la transcripción y el análisis</p>
      </div>
    </div>
  );
}

// ── Loading animation (video frame scanner + circular progress ring) ─────────
function SearchAnimation({ page, total }: { page: number; total: number }) {
  const indeterminate = total === 0;
  const pct = total > 0 ? Math.round((page / total) * 100) : 0;
  const R = 50;
  const circ = 2 * Math.PI * R;
  // Indeterminate: show a 25% arc that spins. Determinate: show filled arc.
  const offset = indeterminate ? circ * 0.75 : circ * (1 - pct / 100);

  const rows = [
    { w: "78%", delay: "0s" },
    { w: "100%", delay: "0.18s" },
    { w: "86%", delay: "0.36s" },
    { w: "62%", delay: "0.54s" },
    { w: "94%", delay: "0.72s" },
    { w: "71%", delay: "0.90s" },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      <style>{`
        @keyframes scanLine {
          0%   { top: 4px;              opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: calc(100% - 4px); opacity: 0; }
        }
        @keyframes recBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.1; }
        }
        @keyframes rowGlow {
          0%   { opacity: 0.12; }
          100% { opacity: 0.5; }
        }
        @keyframes ringSpinCw {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
      `}</style>

      {/* Video-frame analyzer */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative rounded-xl overflow-hidden bg-gray-800/60 border border-gray-700/60"
          style={{ width: 304, height: 180 }}
        >
          {/* Viewfinder corner marks */}
          {[
            "top-2.5 left-2.5 border-t-2 border-l-2 rounded-tl",
            "top-2.5 right-2.5 border-t-2 border-r-2 rounded-tr",
            "bottom-2.5 left-2.5 border-b-2 border-l-2 rounded-bl",
            "bottom-2.5 right-2.5 border-b-2 border-r-2 rounded-br",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-4 h-4 border-cyan-500/60 ${cls}`} />
          ))}

          {/* Simulated transcript lines */}
          <div className="px-7 pt-9 pb-5 flex flex-col gap-2.5">
            {rows.map(({ w, delay }, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  width: w,
                  background: "linear-gradient(to right, #06b6d4, #3b82f6)",
                  animation: `rowGlow 1.4s ease-in-out ${delay} infinite alternate`,
                }}
              />
            ))}
          </div>

          {/* Scanning light */}
          <div
            className="absolute inset-x-0 h-px"
            style={{
              background: "linear-gradient(to right, transparent 0%, #06b6d4 40%, #3b82f6 60%, transparent 100%)",
              boxShadow: "0 0 12px 3px rgba(6,182,212,0.35)",
              animation: "scanLine 2.4s ease-in-out infinite",
            }}
          />

          {/* REC indicator */}
          <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full bg-red-500"
              style={{ animation: "recBlink 1.1s ease-in-out infinite" }}
            />
            <span className="text-[10px] font-bold tracking-widest text-red-400">REC</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 tracking-wide">Buscando grabaciones de demos…</p>
      </div>

      {/* Circular progress ring */}
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg
            className="w-full h-full"
            viewBox="0 0 120 120"
            style={indeterminate
              ? { animation: "ringSpinCw 1.1s linear infinite" }
              : { transform: "rotate(-90deg)" }
            }
          >
            <circle cx="60" cy="60" r={R} fill="none" stroke="#1f2937" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none"
              stroke="url(#tldv-ring)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={indeterminate ? undefined : { transition: "stroke-dashoffset 0.45s ease" }}
            />
            <defs>
              <linearGradient id="tldv-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          {!indeterminate && (
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
              {pct}%
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-white font-semibold text-base leading-tight">
            {indeterminate ? "Iniciando…" : `Página ${page} de ${total}`}
          </p>
          <p className="text-gray-500 text-sm">
            {indeterminate ? "Conectando con CRM…" : `${pct}% completado`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Transcript skeleton ─────────────────────────────────────────────────────
function TranscriptSkeleton() {
  const widths = ["w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-4/5"];
  return (
    <div className="flex flex-col gap-2.5 animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-gray-700/40 px-4 py-3 bg-gray-800/30">
          <div className="h-2 w-16 bg-gray-700/60 rounded mb-3" />
          <div className={`h-2 ${widths[i * 2 % widths.length]} bg-gray-700/40 rounded mb-1.5`} />
          <div className={`h-2 ${widths[(i * 2 + 1) % widths.length]} bg-gray-700/40 rounded`} />
        </div>
      ))}
    </div>
  );
}
