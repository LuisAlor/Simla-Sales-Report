import type { TldvTranscriptSegment } from "./tldvApi";

export interface DemoAnalysis {
  rating: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  keyMoments: string[];
  redFlags: string[];
  recommendedActions: string[];
}

const CACHE_PREFIX = "simla_tldv_analysis_";

export function getCachedAnalysis(meetingId: string): DemoAnalysis | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${meetingId}`);
    return raw ? (JSON.parse(raw) as DemoAnalysis) : null;
  } catch { return null; }
}

function cacheAnalysis(meetingId: string, a: DemoAnalysis) {
  try { localStorage.setItem(`${CACHE_PREFIX}${meetingId}`, JSON.stringify(a)); } catch { /* ignore */ }
}

export const DEFAULT_ANALYSIS_PROMPT = `You are an expert sales coach evaluating a sales demo transcript.

Context:
- Project/Company: {{projectName}}
- Manager conducting the demo: {{managerName}}

Transcript:
{{transcript}}

Evaluate this sales demo and return ONLY a JSON object with this exact structure:
{
  "rating": <integer 1-10>,
  "summary": "<2-3 sentence overview of the demo quality>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area to improve 1>", "<area to improve 2>", "<area to improve 3>"],
  "keyMoments": ["<notable exchange or turning point>"],
  "redFlags": ["<concerning pattern or missed opportunity>"],
  "recommendedActions": ["<concrete action for the next interaction>"]
}

Rating scale: 1-3 poor, 4-5 below average, 6-7 average, 8-9 good, 10 exceptional.
Consider: discovery quality, solution presentation, objection handling, rapport building, clear next steps.
Return ONLY the JSON, no other text.`;

export async function analyzeDemoTranscript(
  anthropicApiKey: string,
  transcript: TldvTranscriptSegment[],
  context: { projectName: string; managerName: string },
  meetingId: string,
  promptTemplate?: string,
): Promise<DemoAnalysis> {
  const cached = getCachedAnalysis(meetingId);
  if (cached) return cached;

  const transcriptText = transcript.map((s) => `${s.speaker}: ${s.text}`).join("\n");
  const tpl = promptTemplate || DEFAULT_ANALYSIS_PROMPT;
  const prompt = tpl
    .replace("{{projectName}}", context.projectName || "Unknown")
    .replace("{{managerName}}", context.managerName || "Unknown")
    .replace("{{transcript}}", transcriptText.slice(0, 12000)); // stay within token budget

  const res = await fetch("/anthropic-api/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");
  const analysis = JSON.parse(match[0]) as DemoAnalysis;
  cacheAnalysis(meetingId, analysis);
  return analysis;
}
