export interface OpenAIModel {
  id: string;
  name: string;
}

export const OPENAI_MODELS: OpenAIModel[] = [
  { id: "gpt-4o",       name: "GPT-4o" },
  { id: "gpt-4o-mini",  name: "GPT-4o Mini (Fast)" },
  { id: "gpt-4-turbo",  name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo",name: "GPT-3.5 Turbo (Budget)" },
];

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const DEFAULT_AI_PROMPT =
`You are a CRM sales analyst. Analyze this meeting transcript and produce a structured report.

## Meeting Summary
2-3 sentences covering what was discussed.

## Client Profile
- Industry / business type
- Company size (if mentioned)
- Current tools / situation

## Identified Needs & Pain Points
Bullet list of what the client needs or struggles with.

## Products / Features of Interest
What they asked about or showed interest in.

## Objections Raised
List objections and how they were handled.

## Lead Qualification
- Score: Hot / Warm / Cold
- Reason for score

## Agreed Next Steps
Concrete actions both sides committed to.

## Follow-up Recommendations
What the sales rep should do before the next contact.

Be concise and use bullet points where possible.`;

export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent  },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `OpenAI API error ${res.status}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
