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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { fetchTldvTranscript, fetchTldvHighlights, tldvMeetingUrl, extractMeetingId } from "@/lib/tldvApi";
import type { TldvTranscriptSegment, TldvHighlight } from "@/lib/tldvApi";
import { fetchOrdersByDemoDate } from "@/lib/api";
import type { RawOrder } from "@/lib/api";

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

function loadCachedHighlights(meetingId: string): TldvHighlight[] | null {
  try {
    const raw = localStorage.getItem(`${HIGHLIGHTS_CACHE_PREFIX}${meetingId}`);
    return raw ? (JSON.parse(raw) as TldvHighlight[]) : null;
  } catch { return null; }
}

function saveCachedHighlights(meetingId: string, items: TldvHighlight[]) {
  try { localStorage.setItem(`${HIGHLIGHTS_CACHE_PREFIX}${meetingId}`, JSON.stringify(items)); } catch { /* ignore */ }
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

function orderToDemoOrder(order: RawOrder): DemoOrder | null {
  const tldvUrl = (order.customFields?.["record_of_meeting_demo"] as string) ?? "";
  if (!tldvUrl) return null;
  const demoDate = (order.customFields?.["demo_date"] as string) ?? "";
  if (!demoDate) return null;
  const valid = isValidTldvMeetingUrl(tldvUrl);
  const meetingId = valid ? extractMeetingId(tldvUrl) : `invalid_${order.id}`;
  return {
    orderId: order.id,
    orderNumber: order.number,
    projectName: (order.customFields?.["name_komp_z"] as string) || "Proyecto sin nombre",
    managerSd: (order.customFields?.["manager_sd"] as string) || "",
    demoDate,
    tldvUrl,
    meetingId,
    invalidUrl: !valid,
  };
}

const SPEAKER_COLORS = [
  "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
  "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800",
  "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
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
  const [activeTab, setActiveTab] = useState<"transcript" | "analysis">("transcript");

  const [transcript, setTranscript] = useState<TldvTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<TldvHighlight[] | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);

  const tldvApiKey = user?.tldvApiKey ?? "";
  const simlaApiKey = user?.apiKey ?? "";

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

  // Load transcript when meeting selected
  useEffect(() => {
    const selected = demoOrders.find((d) => d.meetingId === selectedId);
    if (!selected || !tldvApiKey) return;
    setTranscript([]);
    setTranscriptError(null);
    setTranscriptLoading(true);
    fetchTldvTranscript(tldvApiKey, selected.meetingId)
      .then((segs) => setTranscript(segs))
      .catch((err) => setTranscriptError(err instanceof Error ? err.message : String(err)))
      .finally(() => setTranscriptLoading(false));
  }, [selectedId, tldvApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cached highlights when meeting changes
  useEffect(() => {
    if (!selectedId) { setHighlights(null); return; }
    const cached = loadCachedHighlights(selectedId);
    setHighlights(cached);
    setHighlightsError(null);
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

  const selectedOrder = demoOrders.find((d) => d.meetingId === selectedId) ?? null;

  // Build speaker color map
  const speakerColors: Record<string, string> = {};
  let colorIdx = 0;
  for (const seg of transcript) {
    if (!speakerColors[seg.speaker]) {
      speakerColors[seg.speaker] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length];
      colorIdx++;
    }
  }

  if (!tldvApiKey) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">{t("tldv_not_configured")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* ── Left panel ── */}
      <div className="w-[420px] shrink-0 flex flex-col border-r border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("tldv_title")}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{t("tldv_subtitle")}</p>
        </div>

        {/* Date filter */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 border border-slate-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 border border-slate-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
          <button
            onClick={handleLoadOrders}
            disabled={loading || !simlaApiKey}
            className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm py-1.5 rounded-md transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                {loadProgress
                  ? `Página ${loadProgress.page} de ${loadProgress.total}…`
                  : t("tldv_loading_meetings")}
              </>
            ) : (
              <>
                <Video size={13} />
                {t("tldv_load_meetings")}
              </>
            )}
          </button>
          {loading && loadProgress && (
            <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className="bg-brand-blue h-1 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((loadProgress.page / loadProgress.total) * 100)}%` }}
              />
            </div>
          )}
          {loadError && <p className="text-red-500 text-xs">{loadError}</p>}
          {!simlaApiKey && (
            <p className="text-yellow-600 dark:text-yellow-400 text-xs">{t("tldv_simla_missing")}</p>
          )}
        </div>

        {/* Count */}
        {demoOrders.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-gray-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {demoOrders.length} {demoOrders.length === 1 ? "demo" : "demos"}
            </span>
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto">
          {demoOrders.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-slate-500">
              <Video size={32} className="opacity-30" />
              <p className="text-sm">{t("tldv_no_meetings")}</p>
            </div>
          )}
          {demoOrders.map((demo) => {
            const isSelected = demo.meetingId === selectedId;
            const managerName = managerSdMap[demo.managerSd] ?? demo.managerSd;

            return (
              <button
                key={demo.meetingId}
                onClick={() => { setSelectedId(demo.meetingId); setActiveTab("transcript"); }}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-gray-700 transition-colors ${
                  isSelected
                    ? demo.invalidUrl
                      ? "bg-yellow-50/60 dark:bg-yellow-900/10 border-l-2 border-l-yellow-400"
                      : "bg-brand-blue/10 border-l-2 border-l-brand-blue"
                    : "hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {demo.projectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDemoDate(demo.demoDate)}
                      </span>
                    </div>
                    {managerName && (
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {managerName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Hash size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400 dark:text-slate-500">{demo.orderNumber}</span>
                    </div>
                    {demo.invalidUrl && (
                      <div className="flex items-center gap-1 mt-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded px-1.5 py-0.5 w-fit">
                        <AlertTriangle size={10} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
                        <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Enlace inválido — requiere supervisión</span>
                      </div>
                    )}
                  </div>
                  {demo.invalidUrl
                    ? <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-1" />
                    : <Video size={13} className="text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
                  }
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-900">
        {!selectedOrder ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
            <Video size={40} className="opacity-20" />
            <p className="text-sm">{t("tldv_no_selection")}</p>
          </div>
        ) : (
          <>
            {/* Right panel header */}
            <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                      {selectedOrder.projectName}
                    </h3>
                    {selectedOrder.invalidUrl && (
                      <span className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle size={11} />
                        Requiere supervisión
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {selectedOrder.managerSd && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {managerSdMap[selectedOrder.managerSd] ?? selectedOrder.managerSd}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDemoDate(selectedOrder.demoDate)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://base.simla.com/orders/${selectedOrder.orderId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-blue transition-colors"
                  >
                    <ExternalLink size={13} />
                    {t("tldv_open_crm")}
                  </a>
                  <a
                    href={tldvMeetingUrl(selectedOrder.meetingId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-blue transition-colors"
                  >
                    <Video size={13} />
                    {t("tldv_open_tldv")}
                  </a>
                </div>
              </div>

              {/* Tab bar — hidden for invalid URLs */}
              {!selectedOrder.invalidUrl && (
                <div className="flex gap-1 mt-3">
                  {(["transcript", "analysis"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab
                          ? "bg-brand-blue text-white"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {tab === "transcript" ? t("tldv_tab_transcript") : t("tldv_tab_analysis")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {selectedOrder.invalidUrl && (
                <div className="p-6">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={20} className="text-yellow-500 shrink-0" />
                      <p className="text-yellow-800 dark:text-yellow-200 font-semibold text-sm">Enlace de grabación inválido</p>
                    </div>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                      El vendedor registró un enlace que no corresponde a una reunión de TLDV. Revisa el pedido y corrige el campo <strong>record_of_meeting_demo</strong>.
                    </p>
                    <div className="bg-yellow-100 dark:bg-yellow-900/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-mono break-all">{selectedOrder.tldvUrl}</p>
                    </div>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Formato válido: <span className="font-mono">https://tldv.io/app/meetings/&lt;id&gt;</span>
                    </p>
                  </div>
                </div>
              )}
              {!selectedOrder.invalidUrl && activeTab === "transcript" && (
                <div className="p-6 flex flex-col gap-2">
                  {transcriptLoading && <TranscriptSkeleton />}
                  {transcriptError && (
                    <p className="text-red-500 text-sm">{transcriptError}</p>
                  )}
                  {!transcriptLoading && !transcriptError && transcript.length === 0 && (
                    <p className="text-slate-400 dark:text-slate-500 text-sm">{t("tldv_no_transcript")}</p>
                  )}
                  {transcript.map((seg, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-4 py-2.5 ${speakerColors[seg.speaker] ?? SPEAKER_COLORS[0]}`}
                    >
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{seg.speaker}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {!selectedOrder.invalidUrl && activeTab === "analysis" && (
                <div className="p-6 flex flex-col gap-3">
                  {/* Not loaded yet */}
                  {highlights === null && !highlightsLoading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                      <Sparkles size={40} className="text-slate-300 dark:text-slate-600" />
                      <div className="text-center">
                        <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
                          {t("tldv_tab_analysis")}
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mb-4 max-w-sm">
                          {t("tldv_analysis_hint")}
                        </p>
                        <button
                          onClick={handleLoadHighlights}
                          className="flex items-center gap-2 bg-brand-blue hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors mx-auto"
                        >
                          <Sparkles size={14} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>
                      {highlightsError && <p className="text-red-500 text-sm">{highlightsError}</p>}
                    </div>
                  )}

                  {highlightsLoading && <AnalysisSkeleton />}

                  {highlights !== null && !highlightsLoading && (
                    <>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            try { localStorage.removeItem(`${HIGHLIGHTS_CACHE_PREFIX}${selectedId}`); } catch { /* ignore */ }
                            setHighlights(null);
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-blue transition-colors"
                        >
                          <RefreshCw size={12} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>

                      {highlights.length === 0 && (
                        <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">
                          {t("tldv_no_highlights")}
                        </p>
                      )}

                      {highlights.map((h, i) => {
                        const title = h.title ?? h.text ?? h.type ?? "Highlight";
                        const body = h.description ?? h.content;
                        const ts = h.startTime ?? h.timestamp;
                        return (
                          <div
                            key={h.id ?? i}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">{title}</p>
                              {ts != null && (
                                <span className="text-xs text-slate-400 shrink-0 mt-0.5">{formatTime(ts)}</span>
                              )}
                            </div>
                            {h.speaker && (
                              <p className="text-xs text-brand-blue mb-1">{h.speaker}</p>
                            )}
                            {body && (
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
                            )}
                          </div>
                        );
                      })}

                      {highlightsError && <p className="text-red-500 text-sm">{highlightsError}</p>}
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

function TranscriptSkeleton() {
  const widths = ["w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-4/5"];
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800">
          <div className="h-2.5 w-20 bg-slate-200 dark:bg-gray-600 rounded mb-3" />
          <div className={`h-2 ${widths[i * 2 % widths.length]} bg-slate-100 dark:bg-gray-700 rounded mb-1.5`} />
          <div className={`h-2 ${widths[(i * 2 + 1) % widths.length]} bg-slate-100 dark:bg-gray-700 rounded`} />
        </div>
      ))}
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse py-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6">
        <div className="h-3 w-32 bg-slate-200 dark:bg-gray-600 rounded mb-4" />
        <div className="flex flex-col gap-2">
          {["w-full","w-5/6","w-4/5","w-full","w-3/4"].map((w, i) => (
            <div key={i} className={`h-2 ${w} bg-slate-100 dark:bg-gray-700 rounded`} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6">
        <div className="h-3 w-24 bg-slate-200 dark:bg-gray-600 rounded mb-4" />
        <div className="flex flex-col gap-2">
          {["w-full","w-4/5","w-5/6"].map((w, i) => (
            <div key={i} className={`h-2 ${w} bg-slate-100 dark:bg-gray-700 rounded`} />
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">Analizando…</p>
    </div>
  );
}
