# Simla CRM Analytics Dashboard

Sales analytics dashboard that queries Simla CRM data (orders, revenue, managers, customers) and visualises KPIs. Includes a TLDV demo-call analysis module with AI-powered transcript analysis.

---

## Commands

All commands run from `web/`:

```bash
npm run dev       # dev server on :5173 (with API proxies)
npm run build     # tsc -b && vite build
npx tsc --noEmit  # type-check only
```

No tests or lint scripts. Always verify with `npx tsc --noEmit` before committing.

---

## Tech Stack

| Layer    | Choice                                          |
|----------|-------------------------------------------------|
| UI       | React 18 + TypeScript                           |
| Build    | Vite 6                                          |
| Styling  | Tailwind CSS                                    |
| Routing  | React Router v6 BrowserRouter (NOT data router) |
| Data     | TanStack Query v5                               |
| Charts   | ECharts (`echarts-for-react`)                   |
| Date     | dayjs                                           |
| Icons    | lucide-react                                    |

---

## Architecture

### Pages

| Page | Purpose |
|------|---------|
| `Analytics.tsx` | Orders/revenue KPIs with charts |
| `Funnel.tsx` | Sales funnel analysis |
| `TLDV.tsx` | Demo-call analysis — transcripts + OpenAI reports |
| `AdminPanel.tsx` | Users, integrations, API keys |
| `Profile.tsx` | User profile + language/theme preferences |

### Key Libraries & Contexts

- **`AuthContext`** — user auth + profile, persisted to localStorage (no backend). `User` has `apiKey`, `tldvApiKey`, `openaiApiKey` + `*Enabled` flags for each.
- **`NavigationGuardContext`** — intercepts in-app navigation via `requestNavigate(to)`. Pages with unsaved changes call `setIsDirty(true)` and clean up on unmount.
- **`I18nContext`** — language (ES/EN/RU). All visible strings via `t(key)` from `useT()`.
- **`ThemeContext`** — light/dark/auto.

### API Layer (`lib/`)

- `api.ts` — Simla REST v5 fetchers. Base URL proxied: `/api/v5/` → `https://base.simla.com/api/v5/`. Auth via `?apiKey=` param. Pagination (up to 100/page) handled inside fetchers; callers get flat arrays.
- `tldvApi.ts` — TLDV transcript fetcher, proxied via `/tldv-api` → `https://pasta.tldv.io`.
- `openai.ts` — OpenAI chat completions wrapper + `DEFAULT_AI_PROMPT`.
- `i18n.ts` — all translation strings for ES/EN/RU.

---

## TLDV Module

**Data flow:** `handleLoadOrders()` → `fetchOrdersByDemoDate()` (Simla orders with `demo_date` custom field) → pick a demo → `fetchTldvTranscript()` → optionally generate AI report via `callOpenAI()`.

**Caching:** Demo list cached in localStorage as `simla_tldv_demos_v2_<userId>`. AI reports cached as `simla_ai_report_v1_<lang>_<meetingId>`. When `DemoOrder` fields change, bump the demo cache prefix version to invalidate stale data.

**AI analysis:** The prompt appends `STRUCTURED_SUFFIX` which instructs the model to return a `<STRUCTURED_DATA>` JSON block containing `closingProbability`, `advisorChecklist`, and `errorMoments`. `parseAiResponse()` extracts this. Checklist criteria are translated client-side via `CRITERION_MAP` because the model ignores language instructions for JSON keys. Language is enforced by appending `IMPORTANT: Write your entire response in <Language>.` to the system prompt.

**Custom fields used:**

| Field key                | Content                                         |
|--------------------------|-------------------------------------------------|
| `demo_date`              | Date of the demo call (ISO string)              |
| `manager_sd`             | Manager (`{code, name}` object — use `cfCode()`) |
| `name_komp_z`            | Project/company name                            |
| `mql_order`              | MQL flag (`yes`/`no`/`1`/`0`)                   |
| `record_of_meeting_demo` | TLDV meeting URL                                |

---

## Code Conventions

- API calls only in `lib/api.ts`, `lib/tldvApi.ts`, `lib/openai.ts` — never fetch directly from pages.
- All user-visible strings via `t(key)`. When adding a feature, add entries for ES, EN, and RU.
- `useMemo` for any `.find()`, `.filter()`, or derived computation used in render.
- Monetary values stay as `number`; format only at display time.
- Shared CSS keyframes in `src/index.css` — do not duplicate in `<style>` tags.
- Git: feature branch → PR → squash merge to `main`.
