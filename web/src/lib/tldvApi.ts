const TLDV_BASE = "/tldv-api/v1alpha1";

export interface TldvMeeting {
  id: string;
  name: string;
  happenedAt: string;
  duration: number;
  url?: string;
}

export interface TldvTranscriptSegment {
  speaker: string;
  text: string;
  startTime?: number;
}

export async function fetchTldvMeetings(apiKey: string, dateFrom?: string, dateTo?: string): Promise<TldvMeeting[]> {
  const all: TldvMeeting[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const res = await fetch(`${TLDV_BASE}/meetings?${params}`, { headers: { "x-api-key": apiKey } });
    if (!res.ok) throw new Error(`TLDV ${res.status} ${res.statusText}`);
    const data = await res.json();
    const meetings: TldvMeeting[] = data.meetings ?? data.data ?? [];
    all.push(...meetings);
    if (page >= (data.pages ?? data.totalPages ?? 1)) break;
    page++;
  }
  return all;
}

export async function fetchTldvTranscript(apiKey: string, meetingId: string): Promise<TldvTranscriptSegment[]> {
  const res = await fetch(`${TLDV_BASE}/meetings/${meetingId}/transcript`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) throw new Error(`TLDV transcript ${res.status}`);
  const data = await res.json();
  console.log("[TLDV transcript] raw response:", JSON.stringify(data, null, 2));
  const raw = data.transcript ?? data.entries ?? data.segments ?? data.sentences ?? data.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

export interface TldvHighlight {
  id?: string;
  title?: string;
  text?: string;
  description?: string;
  content?: string;
  speaker?: string;
  startTime?: number;
  timestamp?: number;
  type?: string;
}

export async function fetchTldvHighlights(apiKey: string, meetingId: string): Promise<TldvHighlight[]> {
  const res = await fetch(`${TLDV_BASE}/meetings/${meetingId}/highlights`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) throw new Error(`TLDV highlights ${res.status}`);
  const data = await res.json();
  const raw = data.highlights ?? data.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

export function tldvMeetingUrl(meetingId: string) {
  return `https://tldv.io/app/meetings/${meetingId}`;
}

export function extractMeetingId(tldvUrl: string): string {
  try {
    const parts = new URL(tldvUrl).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return tldvUrl.split("/").filter(Boolean).pop() ?? "";
  }
}
