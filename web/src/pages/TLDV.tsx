import { useState, useEffect, useRef } from "react";
import {
  Video,
  ExternalLink,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle,
  Lightbulb,
  AlertTriangle,
  Target,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { fetchTldvMeetings, fetchTldvTranscript, tldvMeetingUrl } from "@/lib/tldvApi";
import type { TldvMeeting, TldvTranscriptSegment } from "@/lib/tldvApi";
import { analyzeDemoTranscript, getCachedAnalysis } from "@/lib/claudeAnalysis";
import type { DemoAnalysis } from "@/lib/claudeAnalysis";
import { fetchOrderByMeetingUrl } from "@/lib/api";

interface Props {
  managerSdMap: Record<string, string>;
}

interface CrmInfo {
  orderId: number;
  projectName: string;
  managerSd: string;
}

type SortMode = "none" | "worst" | "best";

const ORDER_CACHE_PREFIX = "simla_tldv_order_";

function loadCachedOrder(meetingId: string): CrmInfo | null | undefined {
  try {
    const raw = localStorage.getItem(`${ORDER_CACHE_PREFIX}${meetingId}`);
    if (raw === null) return undefined;
    if (raw === "null") return null;
    return JSON.parse(raw) as CrmInfo;
  } catch {
    return undefined;
  }
}

function saveCachedOrder(meetingId: string, info: CrmInfo | null) {
  try {
    localStorage.setItem(`${ORDER_CACHE_PREFIX}${meetingId}`, info === null ? "null" : JSON.stringify(info));
  } catch { /* ignore */ }
}

function formatDuration(d: number): string {
  // If duration > 3600, it's probably in seconds (even 60 min = 3600s)
  // Heuristic: if d > 300, treat as seconds; else treat as minutes
  if (d > 300) {
    return `${Math.floor(d / 60)}m`;
  }
  return `${d}m`;
}

function ratingColor(rating: number): string {
  if (rating >= 8) return "text-green-500";
  if (rating >= 6) return "text-yellow-500";
  if (rating >= 4) return "text-orange-500";
  return "text-red-500";
}

function ratingBg(rating: number): string {
  if (rating >= 8) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  if (rating >= 6) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
  if (rating >= 4) return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
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
  const [meetings, setMeetings] = useState<TldvMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [crmCache, setCrmCache] = useState<Map<string, CrmInfo | null>>(() => new Map());
  const crmFetching = useRef<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"transcript" | "analysis">("transcript");

  const [transcript, setTranscript] = useState<TldvTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("none");

  const tldvApiKey = user?.tldvApiKey ?? "";
  const simlaApiKey = user?.apiKey ?? "";
  const anthropicApiKey = user?.anthropicApiKey ?? "";

  // Load CRM info for a meeting
  async function loadCrmInfo(meeting: TldvMeeting) {
    const id = meeting.id;
    if (crmCache.has(id) || crmFetching.current.has(id)) return;
    crmFetching.current.add(id);

    // Check localStorage first
    const cached = loadCachedOrder(id);
    if (cached !== undefined) {
      setCrmCache((prev) => new Map(prev).set(id, cached));
      crmFetching.current.delete(id);
      return;
    }

    if (!simlaApiKey) {
      setCrmCache((prev) => new Map(prev).set(id, null));
      crmFetching.current.delete(id);
      return;
    }

    try {
      const url = tldvMeetingUrl(id);
      const order = await fetchOrderByMeetingUrl(simlaApiKey, url);
      if (order) {
        const info: CrmInfo = {
          orderId: order.id,
          projectName: (order.customFields?.["project_name"] as string) || order.number || String(order.id),
          managerSd: (order.customFields?.["manager_sd"] as string) || "",
        };
        saveCachedOrder(id, info);
        setCrmCache((prev) => new Map(prev).set(id, info));
      } else {
        saveCachedOrder(id, null);
        setCrmCache((prev) => new Map(prev).set(id, null));
      }
    } catch {
      setCrmCache((prev) => new Map(prev).set(id, null));
    }
    crmFetching.current.delete(id);
  }

  async function handleLoadMeetings() {
    if (!tldvApiKey) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchTldvMeetings(tldvApiKey, dateFrom || undefined, dateTo || undefined);
      setMeetings(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Trigger CRM lookup for visible meetings
  useEffect(() => {
    if (!meetings.length) return;
    for (const m of meetings) {
      loadCrmInfo(m);
    }
  }, [meetings, simlaApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load transcript when meeting selected
  useEffect(() => {
    if (!selectedId || !tldvApiKey) return;
    setTranscript([]);
    setTranscriptError(null);
    setTranscriptLoading(true);
    fetchTldvTranscript(tldvApiKey, selectedId)
      .then((segs) => setTranscript(segs))
      .catch((err) => setTranscriptError(err instanceof Error ? err.message : String(err)))
      .finally(() => setTranscriptLoading(false));
  }, [selectedId, tldvApiKey]);

  // Load cached analysis when meeting selected
  useEffect(() => {
    if (!selectedId) { setAnalysis(null); return; }
    const cached = getCachedAnalysis(selectedId);
    setAnalysis(cached);
    setAnalysisError(null);
  }, [selectedId]);

  async function handleRunAnalysis() {
    if (!selectedId || !anthropicApiKey) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const crmInfo = crmCache.get(selectedId);
      const projectName = crmInfo?.projectName ?? "Unknown";
      const managerSdCode = crmInfo?.managerSd ?? "";
      const managerName = (managerSdMap[managerSdCode] ?? managerSdCode) || "Unknown";
      const result = await analyzeDemoTranscript(
        anthropicApiKey,
        transcript,
        { projectName, managerName },
        selectedId,
        user?.analysisPrompt,
      );
      setAnalysis(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalysisLoading(false);
    }
  }

  // Sort meetings
  const sortedMeetings = (() => {
    if (sortMode === "none") return meetings;
    return [...meetings].sort((a, b) => {
      const ra = getCachedAnalysis(a.id)?.rating ?? (sortMode === "worst" ? 11 : -1);
      const rb = getCachedAnalysis(b.id)?.rating ?? (sortMode === "worst" ? 11 : -1);
      return sortMode === "worst" ? ra - rb : rb - ra;
    });
  })();

  function cycleSortMode() {
    setSortMode((prev) => prev === "none" ? "worst" : prev === "worst" ? "best" : "none");
  }

  const selectedMeeting = meetings.find((m) => m.id === selectedId) ?? null;
  const selectedCrm = selectedId ? crmCache.get(selectedId) ?? null : null;

  function SortIcon() {
    if (sortMode === "none") return <ArrowUpDown size={14} />;
    if (sortMode === "worst") return <ArrowUp size={14} className="text-red-400" />;
    return <ArrowDown size={14} className="text-green-400" />;
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

  // Build speaker color map
  const speakerColors: Record<string, string> = {};
  let colorIdx = 0;
  for (const seg of transcript) {
    if (!speakerColors[seg.speaker]) {
      speakerColors[seg.speaker] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length];
      colorIdx++;
    }
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
            onClick={handleLoadMeetings}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm py-1.5 rounded-md transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                {t("tldv_loading_meetings")}
              </>
            ) : (
              <>
                <Video size={13} />
                {t("tldv_load_meetings")}
              </>
            )}
          </button>
          {loadError && <p className="text-red-500 text-xs">{loadError}</p>}
        </div>

        {/* Sort toggle */}
        {meetings.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {meetings.length} {meetings.length === 1 ? "reunión" : "reuniones"}
            </span>
            <button
              onClick={cycleSortMode}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                sortMode !== "none"
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              }`}
            >
              <SortIcon />
              {sortMode === "none" ? t("tldv_sort_none") : sortMode === "worst" ? t("tldv_sort_worst") : t("tldv_sort_best")}
            </button>
          </div>
        )}

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto">
          {meetings.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-slate-500">
              <Video size={32} className="opacity-30" />
              <p className="text-sm">{t("tldv_no_meetings")}</p>
            </div>
          )}
          {sortedMeetings.map((meeting) => {
            const crm = crmCache.get(meeting.id);
            const cachedAnalysis = getCachedAnalysis(meeting.id);
            const isSelected = meeting.id === selectedId;
            const dateStr = meeting.happenedAt
              ? new Date(meeting.happenedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
              : "—";
            const managerSdCode = crm?.managerSd ?? "";
            const managerName = managerSdMap[managerSdCode] ?? managerSdCode;

            return (
              <button
                key={meeting.id}
                onClick={() => { setSelectedId(meeting.id); setActiveTab("transcript"); }}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-gray-700 transition-colors ${
                  isSelected
                    ? "bg-brand-blue/10 border-l-2 border-l-brand-blue"
                    : "hover:bg-slate-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{meeting.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 dark:text-slate-500">{dateStr}</span>
                      {meeting.duration > 0 && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">{formatDuration(meeting.duration)}</span>
                      )}
                    </div>
                    {crm && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {crm.projectName && (
                          <p className="text-xs text-brand-blue truncate">{crm.projectName}</p>
                        )}
                        {managerName && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{managerName}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {cachedAnalysis && (
                    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold ${ratingBg(cachedAnalysis.rating)}`}>
                      {cachedAnalysis.rating}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-900">
        {!selectedMeeting ? (
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
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{selectedMeeting.name}</h3>
                  {selectedCrm && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {selectedCrm.projectName && (
                        <span className="text-sm text-brand-blue font-medium">{selectedCrm.projectName}</span>
                      )}
                      {selectedCrm.managerSd && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {managerSdMap[selectedCrm.managerSd] ?? selectedCrm.managerSd}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedCrm?.orderId && (
                    <a
                      href={`https://base.simla.com/orders/${selectedCrm.orderId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand-blue transition-colors"
                    >
                      <ExternalLink size={13} />
                      {t("tldv_open_crm")}
                    </a>
                  )}
                  <a
                    href={tldvMeetingUrl(selectedMeeting.id)}
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
                  {transcriptLoading && (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
                      <RefreshCw size={14} className="animate-spin" />
                      {t("tldv_loading_meetings")}
                    </div>
                  )}
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
                  {!analysis && !analysisLoading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                      <Star size={40} className="text-slate-300 dark:text-slate-600" />
                      <div className="text-center">
                        <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">{t("tldv_tab_analysis")}</p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mb-4 max-w-sm">
                          {!anthropicApiKey ? t("tldv_anthropic_missing") : "Haz clic para analizar este demo con Claude AI"}
                        </p>
                        <button
                          onClick={handleRunAnalysis}
                          disabled={!anthropicApiKey || analysisLoading || transcript.length === 0}
                          title={!anthropicApiKey ? t("tldv_anthropic_missing") : undefined}
                          className="flex items-center gap-2 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
                        >
                          <Star size={14} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>
                      {analysisError && (
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-red-500 text-sm">{analysisError}</p>
                          <button
                            onClick={handleRunAnalysis}
                            className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline"
                          >
                            <RefreshCw size={12} />
                            {t("tldv_run_analysis")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {analysisLoading && (
                    <div className="flex items-center justify-center gap-2 py-12 text-slate-400 dark:text-slate-500">
                      <RefreshCw size={18} className="animate-spin" />
                      <span className="text-sm">{t("tldv_analyzing")}</span>
                    </div>
                  )}

                  {analysis && !analysisLoading && (
                    <>
                      {/* Rating */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 flex items-center gap-6">
                        <div className={`text-6xl font-black ${ratingColor(analysis.rating)}`}>
                          {analysis.rating}
                          <span className="text-2xl text-slate-300 dark:text-slate-600">/10</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{t("tldv_section_summary")}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{analysis.summary}</p>
                        </div>
                      </div>

                      {/* Retry button */}
                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            // Clear cached analysis and re-run
                            try { localStorage.removeItem(`simla_tldv_analysis_${selectedId}`); } catch { /* ignore */ }
                            setAnalysis(null);
                            await handleRunAnalysis();
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-blue transition-colors"
                        >
                          <RefreshCw size={12} />
                          {t("tldv_run_analysis")}
                        </button>
                      </div>

                      {/* Cards */}
                      <AnalysisCard
                        icon={<CheckCircle size={16} className="text-green-500" />}
                        title={t("tldv_section_strengths")}
                        items={analysis.strengths}
                        color="green"
                      />
                      <AnalysisCard
                        icon={<Lightbulb size={16} className="text-yellow-500" />}
                        title={t("tldv_section_improvements")}
                        items={analysis.improvements}
                        color="yellow"
                      />
                      <AnalysisCard
                        icon={<Star size={16} className="text-blue-500" />}
                        title={t("tldv_section_key_moments")}
                        items={analysis.keyMoments}
                        color="blue"
                      />
                      {analysis.redFlags.length > 0 && (
                        <AnalysisCard
                          icon={<AlertTriangle size={16} className="text-red-500" />}
                          title={t("tldv_section_red_flags")}
                          items={analysis.redFlags}
                          color="red"
                        />
                      )}
                      <AnalysisCard
                        icon={<Target size={16} className="text-purple-500" />}
                        title={t("tldv_section_actions")}
                        items={analysis.recommendedActions}
                        color="purple"
                      />
                    </>
                  )}

                  {analysis && analysisError && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-red-500 text-sm">{analysisError}</p>
                      <button
                        onClick={handleRunAnalysis}
                        className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline"
                      >
                        <RefreshCw size={12} />
                        {t("tldv_run_analysis")}
                      </button>
                    </div>
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

interface AnalysisCardProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: "green" | "yellow" | "blue" | "red" | "purple";
}

const cardBorder: Record<string, string> = {
  green:  "border-green-200 dark:border-green-800",
  yellow: "border-yellow-200 dark:border-yellow-800",
  blue:   "border-blue-200 dark:border-blue-800",
  red:    "border-red-200 dark:border-red-800",
  purple: "border-purple-200 dark:border-purple-800",
};

function AnalysisCard({ icon, title, items, color }: AnalysisCardProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border ${cardBorder[color]} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
