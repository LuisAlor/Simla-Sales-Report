import { useState, useEffect, useMemo } from "react";
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
  Bot,
  Settings2,
} from "lucide-react";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useI18n } from "@/contexts/I18nContext";
import { fetchTldvTranscript, tldvMeetingUrl, extractMeetingId } from "@/lib/tldvApi";
import type { TldvTranscriptSegment } from "@/lib/tldvApi";
import { fetchOrdersByDemoDate } from "@/lib/api";
import type { RawOrder } from "@/lib/api";
import { callOpenAI, DEFAULT_OPENAI_MODEL, DEFAULT_AI_PROMPT } from "@/lib/openai";

interface Props {
  managerSdMap: Record<string, string>;
}

interface DemoOrder {
  orderId: number;
  orderNumber: string;
  projectName: string;
  managerSd: string;
  demoDate: string;
  tldvUrl: string;
  meetingId: string;
  invalidUrl: boolean;
  customerName: string;
  crmField: string;
  mqlOrder: string;
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
  return {
    orderId: order.id,
    orderNumber: order.number,
    projectName: (order.customFields?.["name_komp_z"] as string) || "Proyecto sin nombre",
    managerSd: cfCode(order.customFields as Record<string, unknown> | undefined, "manager_sd"),
    demoDate,
    tldvUrl,
    meetingId,
    invalidUrl: !valid,
    customerName: toTitleCase([firstName, lastName].filter(Boolean).join(" ")),
    crmField: "",
    mqlOrder: (order.customFields?.["mql_order"] as string) || "",
  };
}

const SPEAKER_PALETTES = [
  { card: "bg-blue-950/40 border-blue-800/40", name: "text-blue-400" },
  { card: "bg-purple-950/40 border-purple-800/40", name: "text-purple-400" },
  { card: "bg-teal-950/40 border-teal-800/40", name: "text-teal-400" },
  { card: "bg-rose-950/40 border-rose-800/40", name: "text-rose-400" },
];

export function TLDV({ managerSdMap }: Props) {
  const { user } = useAuth();
  const t = useT();
  const { lang } = useI18n();
  const { requestNavigate } = useNavigationGuard();

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>([]);
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ page: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transcript" | "ai_report">("transcript");

  const [transcript, setTranscript] = useState<TldvTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  // Resolve keys + detect disabled state
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
      setDemoOrders(cached.demos);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      setDemoOrders(demos);
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
    if (!selectedId) { setAiReport(null); return; }
    setAiReport(loadCachedAiReport(selectedId, lang));
    setAiReportError(null);
  }, [selectedId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateAiReport(forceRegenerate = false) {
    if (!selectedId || !openaiApiKey) return;
    if (!forceRegenerate) {
      const cached = loadCachedAiReport(selectedId, lang);
      if (cached) { setAiReport(cached); return; }
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
      const report = await callOpenAI(openaiApiKey, openaiModel, openaiPrompt + langInstruction, transcriptText);
      setAiReport(report);
      saveCachedAiReport(selectedId, lang, report);
    } catch (err) {
      setAiReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiReportLoading(false);
    }
  }

  const selectedOrder = demoOrders.find((d) => d.meetingId === selectedId) ?? null;

  // Unique managers from loaded demos (code → display name)
  const availableManagers = useMemo(() => {
    const seen = new Set<string>();
    const list: { code: string; name: string }[] = [];
    for (const d of demoOrders) {
      if (d.managerSd && !seen.has(d.managerSd)) {
        seen.add(d.managerSd);
        list.push({ code: d.managerSd, name: managerSdMap[d.managerSd] ?? d.managerSd });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [demoOrders, managerSdMap]);

  const filteredDemos = useMemo(() =>
    managerFilter === "all" ? demoOrders : demoOrders.filter((d) => d.managerSd === managerFilter),
  [demoOrders, managerFilter]);

  // Build speaker index map for consistent palette assignment
  const speakerIndex: Record<string, number> = {};
  let sidx = 0;
  for (const seg of transcript) {
    if (speakerIndex[seg.speaker] === undefined) speakerIndex[seg.speaker] = sidx++;
  }

  if (!tldvApiKey) {
    return (
      <div className="p-6">
        <div className={`rounded-xl p-4 flex items-start gap-3 border ${
          tldvIsDisabled
            ? "bg-orange-950/30 border-orange-800/50"
            : "bg-yellow-950/30 border-yellow-800/50"
        }`}>
          <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${tldvIsDisabled ? "text-orange-400" : "text-yellow-500"}`} />
          <div>
            <p className={`text-sm font-semibold mb-0.5 ${tldvIsDisabled ? "text-orange-300" : "text-yellow-300"}`}>
              {tldvIsDisabled ? "TLDV" : "TLDV"}
            </p>
            <p className={`text-sm ${tldvIsDisabled ? "text-orange-400/80" : "text-yellow-400"}`}>
              {tldvIsDisabled ? t("tldv_tldv_disabled") : t("tldv_not_configured")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-gray-950">

      {/* ── Left panel ── */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-800 bg-gray-900">

        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
              <Video size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">{t("tldv_title")}</h2>
          </div>
          <p className="text-gray-600 text-xs mt-0.5 pl-9">{t("tldv_subtitle")}</p>
        </div>

        {/* Filters */}
        <div className="px-5 pb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs bg-gray-800/80 text-gray-300 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all"
            />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs bg-gray-800/80 text-gray-300 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all"
            />
          </div>
          {availableManagers.length > 0 && (
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="w-full border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs bg-gray-800/80 text-gray-300 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all"
            >
              <option value="all">{t("filter_all")}</option>
              {availableManagers.map((m) => (
                <option key={m.code} value={m.code}>{m.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleLoadOrders}
            disabled={loading || !simlaApiKey}
            className="w-full flex items-center justify-center gap-2 text-white font-semibold text-sm py-2 rounded-lg transition-all disabled:opacity-40 active:scale-[0.98]"
            style={{ background: loading ? "#1d4ed8" : "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)" }}
          >
            {loading ? (
              <><RefreshCw size={13} className="animate-spin" /> Buscando…</>
            ) : (
              <><Play size={12} fill="white" /> {t("tldv_load_meetings")}</>
            )}
          </button>
          {loadError && <p className="text-red-400 text-xs">{loadError}</p>}
          {!simlaApiKey && (
            <p className={`text-xs ${simlaIsDisabled ? "text-orange-400/80" : "text-yellow-500/80"}`}>
              {simlaIsDisabled ? t("tldv_simla_disabled") : t("tldv_simla_missing")}
            </p>
          )}
        </div>

        <div className="h-px bg-gray-800 mx-5" />

        {/* Count */}
        {demoOrders.length > 0 && (
          <div className="px-5 py-2.5">
            <span className="text-xs text-gray-600">
              {filteredDemos.length}{demoOrders.length !== filteredDemos.length ? ` / ${demoOrders.length}` : ""} demo{filteredDemos.length !== 1 ? "s" : ""} encontrado{filteredDemos.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 flex flex-col gap-1.5">
          {filteredDemos.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700 select-none">
              <Video size={28} className="opacity-30" />
              <p className="text-xs">{t("tldv_no_meetings")}</p>
            </div>
          )}
          {filteredDemos.map((demo) => {
            const isSelected = demo.meetingId === selectedId;
            const managerName = demo.managerSd
              ? (managerSdMap[demo.managerSd] ?? demo.managerSd)
              : null;
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar size={10} className="text-gray-600" />
                        {formatDemoDate(demo.demoDate)}
                      </span>
                      {managerName && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-[120px]">
                          <User size={10} className="text-gray-600 shrink-0" />
                          {managerName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Hash size={10} className="text-gray-700" />
                        {demo.orderNumber}
                      </span>
                    </div>
                    {demo.invalidUrl && (
                      <div className="flex items-center gap-1 bg-yellow-900/25 border border-yellow-700/35 rounded-md px-2 py-0.5 w-fit mt-0.5">
                        <AlertTriangle size={9} className="text-yellow-500 shrink-0" />
                        <span className="text-xs text-yellow-400 font-medium">Enlace inválido</span>
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
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#0c0e14" }}>
        {loading ? (
          <SearchAnimation page={loadProgress?.page ?? 0} total={loadProgress?.total ?? 0} />
        ) : !selectedOrder ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-0 bg-gray-900/70 border-b border-gray-800 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4 pb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white truncate">{selectedOrder.projectName}</h3>
                    {selectedOrder.invalidUrl && (
                      <span className="flex items-center gap-1 bg-yellow-900/35 border border-yellow-700/45 text-yellow-400 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle size={10} />
                        Requiere supervisión
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    {selectedOrder.customerName && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <UserCircle size={12} className="text-gray-500 shrink-0" />
                        {selectedOrder.customerName}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar size={11} className="text-gray-600 shrink-0" />
                      {formatDemoDate(selectedOrder.demoDate)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Tag size={11} className="text-gray-600 shrink-0" />
                      {formatMql(selectedOrder.mqlOrder)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <a href={`https://base.simla.com/orders/${selectedOrder.orderId}/edit`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-cyan-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-800"
                  >
                    <ExternalLink size={12} /> Ir al Pedido
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
            <div className="flex-1 overflow-y-auto">

              {/* Invalid URL warning panel */}
              {selectedOrder.invalidUrl && (
                <div className="p-6">
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
              )}

              {/* Transcript */}
              {!selectedOrder.invalidUrl && activeTab === "transcript" && (
                <div className="p-6 flex flex-col gap-2">
                  {transcriptLoading && <TranscriptSkeleton />}
                  {transcriptError && <p className="text-red-400 text-sm">{transcriptError}</p>}
                  {!transcriptLoading && !transcriptError && transcript.length === 0 && (
                    <p className="text-gray-700 text-sm">{t("tldv_no_transcript")}</p>
                  )}
                  {transcript.map((seg, i) => {
                    const palette = SPEAKER_PALETTES[(speakerIndex[seg.speaker] ?? 0) % SPEAKER_PALETTES.length];
                    return (
                      <div key={i} className={`rounded-xl border px-4 py-3 ${palette.card}`}>
                        <p className={`text-xs font-semibold mb-1.5 ${palette.name}`}>{seg.speaker}</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{seg.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI Analysis */}
              {!selectedOrder.invalidUrl && activeTab === "ai_report" && (
                <div className="p-6 flex flex-col gap-4">
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

                  {/* Has API key */}
                  {openaiApiKey && !aiReportLoading && aiReport === null && (
                    <div className="flex flex-col items-center justify-center gap-5 py-16">
                      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                        <Bot size={26} className="text-violet-400/60" />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 font-semibold mb-1">{t("tldv_ai_report_tab")}</p>
                        <p className="text-gray-600 text-sm mb-5 max-w-xs">
                          {transcript.length === 0 ? t("tldv_ai_no_transcript") : `${t("tldv_model_used")} ${openaiModel}`}
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
                  {aiReportLoading && <AiLoadingAnimation model={openaiModel} />}

                  {/* Report rendered */}
                  {!aiReportLoading && aiReport !== null && openaiApiKey && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Bot size={14} className="text-violet-400" />
                          <span className="text-xs text-gray-500">
                            <span className="text-gray-600">{t("tldv_model_used")}</span> {openaiModel}
                          </span>
                          <button
                            onClick={() => requestNavigate("/admin?tab=integraciones")}
                            title={t("tldv_configure_settings")}
                            className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-violet-400 transition-colors"
                          >
                            <Settings2 size={11} />
                          </button>
                        </div>
                        <button
                          onClick={() => handleGenerateAiReport(true)}
                          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-violet-400 transition-colors"
                        >
                          <RefreshCw size={11} /> {t("tldv_ai_regenerate")}
                        </button>
                      </div>
                      <AiReportRenderer text={aiReport} />
                    </>
                  )}
                </div>
              )}

            </div>
          </>
        )}
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

function AiLoadingAnimation({ model }: { model: string }) {
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
        <p className="text-gray-600 text-xs mt-1">{t("tldv_model_used")} {model}</p>
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

