import { useState, useEffect, useRef } from "react";
import {
  Video,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { fetchTldvTranscript, fetchTldvAnalysis, tldvMeetingUrl, extractMeetingId } from "@/lib/tldvApi";
import type { TldvTranscriptSegment } from "@/lib/tldvApi";
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
}

const ANALYSIS_CACHE_PREFIX = "simla_tldv_analysis_v2_";

function loadCachedAnalysis(meetingId: string): string | null {
  try {
    return localStorage.getItem(`${ANALYSIS_CACHE_PREFIX}${meetingId}`);
  } catch { return null; }
}

function saveCachedAnalysis(meetingId: string, text: string) {
  try { localStorage.setItem(`${ANALYSIS_CACHE_PREFIX}${meetingId}`, text); } catch { /* ignore */ }
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
  const meetingId = extractMeetingId(tldvUrl);
  if (!meetingId) return null;
  return {
    orderId: order.id,
    orderNumber: order.number,
    projectName: (order.customFields?.["name_komp_z"] as string) || order.number || String(order.id),
    managerSd: (order.customFields?.["manager_sd"] as string) || "",
    demoDate: (order.customFields?.["demo_date"] as string) || order.createdAt || "",
    tldvUrl,
    meetingId,
  };
}

const DEFAULT_PROMPT =
  "Analiza este demo de venta. Evalúa: apertura, detección de necesidades, presentación de valor, manejo de objeciones y cierre. Indica fortalezas, áreas de mejora y acciones concretas para el asesor.";

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

  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const tldvApiKey = user?.tldvApiKey ?? "";
  const simlaApiKey = user?.apiKey ?? "";
  const analysisPrompt = user?.analysisPrompt ?? DEFAULT_PROMPT;

  // abort controller for analysis
  const analysisAbort = useRef<AbortController | null>(null);

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

  // Load cached analysis when meeting changes
  useEffect(() => {
    if (!selectedId) { setAnalysisText(null); return; }
    const cached = loadCachedAnalysis(selectedId);
    setAnalysisText(cached);
    setAnalysisError(null);
  }, [selectedId]);

  async function handleRunAnalysis() {
    const selected = demoOrders.find((d) => d.meetingId === selectedId);
    if (!selected || !tldvApiKey) return;
    analysisAbort.current?.abort();
    analysisAbort.current = new AbortController();
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await fetchTldvAnalysis(tldvApiKey, selected.meetingId, analysisPrompt);
      setAnalysisText(result);
      saveCachedAnalysis(selected.meetingId, result);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAnalysisError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setAnalysisLoading(false);
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
                    ? "bg-brand-blue/10 border-l-2 border-l-brand-blue"
                    : "hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {demo.projectName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDemoDate(demo.demoDate)}
                      </span>
                      {managerName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {managerName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">#{demo.orderNumber}</p>
                  </div>
                  <Video size={13} className="text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
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
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                    {selectedOrder.projectName}
                  </h3>
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

              {/* Tab bar */}
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
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "transcript" && (
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

              {activeTab === "analysis" && (
                <div className="p-6 flex flex-col gap-4">
                  {!analysisText && !analysisLoading && (
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
                          onClick={handleRunAnalysis}
                          disabled={analysisLoading}
                          className="flex items-center gap-2 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors mx-auto"
                        >
                          <Sparkles size={14} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>
                      {analysisError && (
                        <p className="text-red-500 text-sm">{analysisError}</p>
                      )}
                    </div>
                  )}

                  {analysisLoading && <AnalysisSkeleton />}

                  {analysisText && !analysisLoading && (
                    <>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            try { localStorage.removeItem(`${ANALYSIS_CACHE_PREFIX}${selectedId}`); } catch { /* ignore */ }
                            setAnalysisText(null);
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-blue transition-colors"
                        >
                          <RefreshCw size={12} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6">
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {analysisText}
                        </p>
                      </div>
                      {analysisError && (
                        <p className="text-red-500 text-sm">{analysisError}</p>
                      )}
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
