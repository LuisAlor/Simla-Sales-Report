import { useState, useEffect } from "react";
import {
  Video,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Calendar,
  User,
  Hash,
  Building2,
  Play,
  UserCircle,
  Tag,
  Bot,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { fetchTldvTranscript, fetchTldvHighlights, tldvMeetingUrl, extractMeetingId } from "@/lib/tldvApi";
import type { TldvTranscriptSegment, TldvHighlight } from "@/lib/tldvApi";
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

const HIGHLIGHTS_CACHE_PREFIX = "simla_tldv_highlights_v2_";
const AI_REPORT_CACHE_PREFIX  = "simla_ai_report_v1_";

function loadCachedHighlights(meetingId: string): TldvHighlight[] | null {
  try {
    const raw = localStorage.getItem(`${HIGHLIGHTS_CACHE_PREFIX}${meetingId}`);
    return raw ? (JSON.parse(raw) as TldvHighlight[]) : null;
  } catch { return null; }
}

function saveCachedHighlights(meetingId: string, items: TldvHighlight[]) {
  try { localStorage.setItem(`${HIGHLIGHTS_CACHE_PREFIX}${meetingId}`, JSON.stringify(items)); } catch { /* ignore */ }
}

function loadCachedAiReport(meetingId: string): string | null {
  try { return localStorage.getItem(`${AI_REPORT_CACHE_PREFIX}${meetingId}`); } catch { return null; }
}

function saveCachedAiReport(meetingId: string, report: string) {
  try { localStorage.setItem(`${AI_REPORT_CACHE_PREFIX}${meetingId}`, report); } catch { /* ignore */ }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDemoDate(raw: string): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
    managerSd: (order.customFields?.["manager_sd"] as string) || "",
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

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ page: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transcript" | "analysis" | "ai_report">("transcript");

  const [transcript, setTranscript] = useState<TldvTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<TldvHighlight[] | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  const tldvApiKey = user?.tldvApiKey ?? "";
  const simlaApiKey = user?.apiKey ?? "";
  const openaiApiKey = user?.openaiApiKey ?? "";
  const openaiModel = user?.openaiModel ?? DEFAULT_OPENAI_MODEL;
  const openaiPrompt = user?.openaiPrompt ?? DEFAULT_AI_PROMPT;

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
    if (!selectedId) { setHighlights(null); return; }
    const cached = loadCachedHighlights(selectedId);
    setHighlights(cached);
    setHighlightsError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) { setAiReport(null); return; }
    setAiReport(loadCachedAiReport(selectedId));
    setAiReportError(null);
  }, [selectedId]);

  async function handleLoadHighlights() {
    const selected = demoOrders.find((d) => d.meetingId === selectedId);
    if (!selected || !tldvApiKey) return;
    setHighlightsLoading(true);
    setHighlightsError(null);
    try {
      const items = await fetchTldvHighlights(tldvApiKey, selected.meetingId);
      setHighlights(items);
      saveCachedHighlights(selected.meetingId, items);
    } catch (err) {
      setHighlightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setHighlightsLoading(false);
    }
  }

  async function handleGenerateAiReport(forceRegenerate = false) {
    if (!selectedId || !openaiApiKey) return;
    if (!forceRegenerate) {
      const cached = loadCachedAiReport(selectedId);
      if (cached) { setAiReport(cached); return; }
    }
    if (transcript.length === 0) { setAiReportError("no_transcript"); return; }
    setAiReportLoading(true);
    setAiReportError(null);
    try {
      const transcriptText = transcript
        .map((seg) => `[${seg.speaker}]: ${seg.text}`)
        .join("\n");
      const report = await callOpenAI(openaiApiKey, openaiModel, openaiPrompt, transcriptText);
      setAiReport(report);
      saveCachedAiReport(selectedId, report);
    } catch (err) {
      setAiReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiReportLoading(false);
    }
  }

  const selectedOrder = demoOrders.find((d) => d.meetingId === selectedId) ?? null;

  // Build speaker index map for consistent palette assignment
  const speakerIndex: Record<string, number> = {};
  let sidx = 0;
  for (const seg of transcript) {
    if (speakerIndex[seg.speaker] === undefined) speakerIndex[seg.speaker] = sidx++;
  }

  if (!tldvApiKey) {
    return (
      <div className="p-6">
        <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-yellow-400 text-sm">{t("tldv_not_configured")}</p>
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

        {/* Date filter + Search */}
        <div className="px-5 pb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs bg-gray-800/80 text-gray-300 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all"
            />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs bg-gray-800/80 text-gray-300 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/20 transition-all"
            />
          </div>
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
          {!simlaApiKey && <p className="text-yellow-500/80 text-xs">{t("tldv_simla_missing")}</p>}
        </div>

        <div className="h-px bg-gray-800 mx-5" />

        {/* Count */}
        {demoOrders.length > 0 && (
          <div className="px-5 py-2.5">
            <span className="text-xs text-gray-600">
              {demoOrders.length} demo{demoOrders.length !== 1 ? "s" : ""} encontrado{demoOrders.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 flex flex-col gap-1.5">
          {demoOrders.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700 select-none">
              <Video size={28} className="opacity-30" />
              <p className="text-xs">{t("tldv_no_meetings")}</p>
            </div>
          )}
          {demoOrders.map((demo) => {
            const isSelected = demo.meetingId === selectedId;
            const managerName = managerSdMap[demo.managerSd] ?? demo.managerSd;
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
                  {(["transcript", "analysis", "ai_report"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                        activeTab === tab
                          ? "border-cyan-500 text-cyan-400"
                          : "border-transparent text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {tab === "ai_report" && <Bot size={13} />}
                      {tab === "transcript" ? t("tldv_tab_transcript") : tab === "analysis" ? t("tldv_tab_analysis") : t("tldv_ai_report_tab")}
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

              {/* Analysis / Highlights */}
              {!selectedOrder.invalidUrl && activeTab === "analysis" && (
                <div className="p-6 flex flex-col gap-3">
                  {highlights === null && !highlightsLoading && (
                    <div className="flex flex-col items-center justify-center gap-5 py-16">
                      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                        <Sparkles size={26} className="text-cyan-500/50" />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-300 font-semibold mb-1">{t("tldv_tab_analysis")}</p>
                        <p className="text-gray-600 text-sm mb-5 max-w-xs">{t("tldv_analysis_hint")}</p>
                        <button onClick={handleLoadHighlights}
                          className="flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl text-sm mx-auto hover:opacity-90 transition-opacity active:scale-[0.98]"
                          style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
                        >
                          <Sparkles size={14} /> {t("tldv_run_analysis")}
                        </button>
                      </div>
                      {highlightsError && <p className="text-red-400 text-sm">{highlightsError}</p>}
                    </div>
                  )}

                  {highlightsLoading && <AnalysisSkeleton />}

                  {highlights !== null && !highlightsLoading && (
                    <>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            try { localStorage.removeItem(`${HIGHLIGHTS_CACHE_PREFIX}${selectedId}`); } catch { /* ignore */ }
                            handleLoadHighlights();
                          }}
                          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-cyan-400 transition-colors"
                        >
                          <RefreshCw size={11} /> {t("tldv_run_analysis")}
                        </button>
                      </div>
                      {highlights.length === 0 && (
                        <p className="text-gray-700 text-sm text-center py-10">{t("tldv_no_highlights")}</p>
                      )}
                      {highlights.length > 0 && (
                        <div className="bg-gray-800/30 border border-gray-700/40 rounded-2xl px-6 py-5 flex flex-col gap-5">
                          {highlights.map((h, i) => {
                            const title = h.title ?? h.text ?? h.type;
                            const body = h.description ?? h.content;
                            const ts = h.startTime ?? h.timestamp;
                            if (!title && !body) return null;
                            return (
                              <div key={h.id ?? i} className="flex flex-col gap-1.5">
                                {title && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0 mt-1.5" />
                                    <p className="text-sm font-semibold text-gray-200 leading-snug">{title}</p>
                                    {ts != null && (
                                      <span className="text-[10px] text-gray-600 font-mono shrink-0">{formatTime(ts)}</span>
                                    )}
                                  </div>
                                )}
                                {body && (
                                  <p className="text-sm text-gray-400 leading-relaxed pl-3.5">{body}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {highlightsError && <p className="text-red-400 text-sm">{highlightsError}</p>}
                    </>
                  )}
                </div>
              )}

              {/* AI Report */}
              {!selectedOrder.invalidUrl && activeTab === "ai_report" && (
                <div className="p-6 flex flex-col gap-4">
                  {/* No API key configured */}
                  {!openaiApiKey && (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                        <Bot size={26} className="text-violet-400/60" />
                      </div>
                      <p className="text-gray-400 text-sm max-w-xs">{t("tldv_ai_no_key")}</p>
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
                          {transcript.length === 0 ? t("tldv_ai_no_transcript") : `${transcript.length} segmentos · ${openaiModel}`}
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
                  {aiReportLoading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                      <Bot size={28} className="text-violet-400 animate-pulse" />
                      <p className="text-gray-400 text-sm">{t("tldv_ai_generating")}</p>
                      <p className="text-gray-600 text-xs">{openaiModel}</p>
                    </div>
                  )}

                  {/* Report rendered */}
                  {!aiReportLoading && aiReport !== null && openaiApiKey && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot size={14} className="text-violet-400" />
                          <span className="text-xs text-gray-500">{openaiModel}</span>
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

// ── AI Report renderer — simple markdown-like formatting ────────────────────
function AiReportRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="bg-gray-800/30 border border-gray-700/40 rounded-2xl px-6 py-5 flex flex-col gap-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith("## "))
          return <p key={i} className="text-base font-bold text-violet-300 mt-3 mb-1">{line.slice(3)}</p>;
        if (line.startsWith("# "))
          return <p key={i} className="text-lg font-bold text-white mt-2">{line.slice(2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2 text-gray-300 pl-2">
              <span className="text-violet-400 shrink-0 mt-0.5">•</span>
              <span>{formatInline(line.slice(2))}</span>
            </div>
          );
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s(.+)/);
          return (
            <div key={i} className="flex gap-2 text-gray-300 pl-2">
              <span className="text-violet-400 shrink-0 font-mono text-xs mt-0.5">{num}.</span>
              <span>{formatInline(rest.join(""))}</span>
            </div>
          );
        }
        return <p key={i} className="text-gray-300">{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
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

// ── Analysis skeleton ───────────────────────────────────────────────────────
function AnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse py-2">
      {(
        [
          { w: "w-40", lines: ["w-full", "w-5/6", "w-4/5", "w-full", "w-3/4"] },
          { w: "w-28", lines: ["w-full", "w-4/5", "w-5/6"] },
          { w: "w-36", lines: ["w-full", "w-3/4", "w-5/6", "w-4/5"] },
        ] as { w: string; lines: string[] }[]
      ).map(({ w, lines }, i) => (
        <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className={`h-2.5 ${w} bg-gray-700/60 rounded mb-4`} />
          <div className="flex flex-col gap-2">
            {lines.map((lw, j) => (
              <div key={j} className={`h-2 ${lw} bg-gray-700/40 rounded`} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-gray-700 pt-1">Cargando highlights…</p>
    </div>
  );
}
