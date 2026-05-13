# Simla CRM Analytics Dashboard

---

## Project Purpose

Sales analytics dashboard that queries Simla CRM data (orders, revenue, managers, customers) and visualises KPIs. Includes a TLDV demo-call analysis module with AI-powered transcript analysis.

---

## Commands

All commands run from `web/`:

```bash
npm run dev       # dev server on :5173 (with API proxies)
npm run build     # tsc -b && vite build
npx tsc --noEmit  # type-check only (run this after every change)
```

There are no tests or lint scripts. TypeScript is the only automated check — always verify with `npx tsc --noEmit` from `web/` before committing.

---

## Repository Layout

```
web/                        React SPA (the main app)
  src/
    pages/
      Analytics.tsx         Main analytics dashboard (orders/revenue/KPIs)
      Funnel.tsx            Sales funnel analysis
      TLDV.tsx              Demo-call analysis (TLDV + OpenAI) — largest file, ~1700 lines
      AdminPanel.tsx        Settings: users, integrations, API keys
      Profile.tsx           User profile + preferences
      Login.tsx / ApiSetup.tsx
    components/
      Layout.tsx            Shell: Sidebar + Outlet; TopFilters only on "/" and "/funnel"
      TopFilters.tsx        Horizontal filter bar (Analytics/Funnel only)
      DateRangePicker.tsx   Unified date picker (calendar + relative presets)
      MultiSelect.tsx       Dropdown multi-select used in TLDV filters
      Sidebar.tsx           Navigation sidebar (h-screen sticky)
      LoadingScreen.tsx     Animated full-page loading state
    contexts/
      AuthContext.tsx       User auth + profile persistence (localStorage)
      NavigationGuardContext.tsx  Unsaved-changes guard — use requestNavigate() for all in-app nav
      I18nContext.tsx       Language selection (ES/EN/RU)
      ThemeContext.tsx      Light/dark/auto theme
    lib/
      api.ts                Simla REST v5 fetchers (orders, statuses, dict options)
      tldvApi.ts            TLDV transcript fetcher (proxied via /tldv-api)
      openai.ts             OpenAI chat completions wrapper + DEFAULT_AI_PROMPT
      i18n.ts               All translation strings (ES/EN/RU) — single source of truth
      auth.ts               User model + localStorage persistence (no backend)
      filters.ts            Filter state types
      transforms.ts         Data aggregation (revenue, funnel, top products)
      flatten.ts            Order → flat record mapper
      ordersCache.ts        localStorage cache for fetched order data
```

---

## Tech Stack

| Layer       | Choice                                              |
|-------------|-----------------------------------------------------|
| UI          | React 18 + TypeScript                               |
| Build       | Vite 6                                              |
| Styling     | Tailwind CSS                                        |
| Routing     | React Router v6 BrowserRouter (NOT data router)     |
| Data        | TanStack Query v5                                   |
| Charts      | ECharts (`echarts-for-react`) — not Recharts        |
| Date util   | dayjs                                               |
| Icons       | lucide-react                                        |

---

## Simla REST v5 API

**Base URL proxied:** `/api/v5/` → `https://base.simla.com/api/v5/`
**Auth:** `?apiKey=<token>` query param (added inside `getJson` in `api.ts`)

Key endpoints: `GET /orders`, `GET /reference/statuses`, `GET /order-types`, `GET /users`, `GET /custom-fields`

Pagination pattern — iterate `page` 1 → `totalPageCount` (max 100 per page). All pagination is handled inside `api.ts` fetchers; callers receive flat arrays.

### Custom fields used in TLDV

| Field key                  | Content                                       |
|----------------------------|-----------------------------------------------|
| `demo_date`                | Date of the demo call (ISO string)            |
| `manager_sd`               | Manager (object `{code, name}` — use `cfCode()`) |
| `name_komp_z`              | Project/company name                          |
| `mql_order`                | MQL flag (`yes`/`no`/`1`/`0`)                 |
| `record_of_meeting_demo`   | TLDV meeting URL                              |

Use `cfCode(customFields, key)` to safely extract `code ?? name` from object-typed custom fields.

---

## TLDV Module (TLDV.tsx)

The most complex page. Key architecture:

**Data flow:**
1. User triggers `handleLoadOrders()` → `fetchOrdersByDemoDate()` → orders stored in `demoOrders` state and cached to localStorage under `DEMO_LIST_CACHE_PREFIX` (currently `simla_tldv_demos_v2_`).
2. Selecting a demo → `fetchTldvTranscript()` runs (via `/tldv-api` proxy to `pasta.tldv.io`).
3. AI report → `callOpenAI()` with transcript text; result cached in localStorage under `AI_REPORT_CACHE_PREFIX` keyed by `lang_meetingId`.

**Cache versioning:** When `DemoOrder` fields change, bump `DEMO_LIST_CACHE_PREFIX` (e.g. `v2_` → `v3_`) to invalidate stale localStorage data.

**AI structured data:**
- `STRUCTURED_SUFFIX` appended to every prompt requests a `<STRUCTURED_DATA>` JSON block.
- `parseAiResponse()` extracts it; result typed as `AiStructuredData` (`closingProbability`, `advisorChecklist`, `errorMoments`).
- `CRITERION_MAP` + `translateCriterion()` translate checklist criteria client-side (AI ignores language instruction for JSON keys).
- Language enforced by appending `IMPORTANT: Write your entire response in <Language>.` to the system prompt.

**Sub-tabs:**
- Transcript tab: "Conversación" (chat bubbles) / "Métricas" (CallMetricsPanel with ECharts)
- AI Analysis tab: "Resumen" (markdown) / "Evaluación" (ProbabilityCard + AdvisorChecklist + ErrorMomentsList + ManagerPerformanceChart)

**Manager performance chart:** Aggregates cached AI results for all demos of the same manager; requires ≥ 2 demos with cached AI data to display.

**Error highlighting:** `errorSegmentSet` maps transcript segment indices to AI error descriptions using ±15 s fuzzy timestamp matching.

**TLDV API proxy:** `tldvApi.ts` uses `TLDV_BASE = "/tldv-api/v1alpha1"` — proxied by Vite to `https://pasta.tldv.io`.

---

## Scroll Layout Pattern for Full-Height Pages

TLDV uses a fixed-height layout (no page scroll). The pattern that works reliably:

```tsx
// Outer container — flex-col with overflow-hidden at every level
<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <div className="shrink-0">/* sticky header */</div>
  {/* Scroll wrapper — relative+absolute guarantees explicit pixel bounds */}
  <div className="relative flex-1 min-h-0">
    <div className="absolute inset-0 overflow-y-auto p-6">
      {/* scrollable content */}
    </div>
  </div>
</div>
```

**Rule:** Every `flex-1` in a `flex-col` chain needs `min-h-0`. The actual scroll container uses `position: absolute; inset: 0` (not `flex-1 overflow-y-auto`) to guarantee it has explicit pixel dimensions.

The `<main>` in `Layout.tsx` uses `overflow-hidden` (not `overflow-y-auto p-6`) when `pathname === "/tldv"`. All other pages scroll normally.

---

## User / Auth Model

No backend. All user data stored in localStorage (`simla_users` key). The `User` interface in `auth.ts` carries:
- `apiKey` — Simla CRM key
- `tldvApiKey` / `tldvEnabled` — TLDV integration
- `openaiApiKey` / `openaiEnabled` / `openaiModel` / `openaiPrompt` / `tldvPrompt` — OpenAI config
- `role: 'admin' | 'viewer'`

API keys have an `*Enabled` flag; when disabled, the key is set to `""` in the component (the raw key is preserved). Check `user?.xyzEnabled !== false` pattern.

---

## Navigation Guard

`NavigationGuardContext` intercepts all in-app navigation via `requestNavigate(to)` — use this instead of `useNavigate()` on pages with forms. Pages with unsaved changes call `setIsDirty(true)` and clean up on unmount:

```tsx
useEffect(() => { setIsDirty(isDirty); }, [isDirty]);
useEffect(() => () => setIsDirty(false), []);
```

---

## i18n

All user-visible strings go through `t(key)` from `useT()`. Keys defined in `web/src/lib/i18n.ts` for ES (default), EN, RU. **When adding any feature, add all three language entries.** Hard-coded user-visible strings are a bug.

---

## Code Conventions

- API calls only in `lib/api.ts`, `lib/tldvApi.ts`, `lib/openai.ts` — never fetch directly from pages.
- `useMemo` for any `.find()`, `.filter()`, or derived computation used in render.
- Monetary values stay as `number`; format only at display time.
- Dates from API are ISO 8601 strings; use `dayjs` for display (or `Date.toLocaleDateString` for simple cases).
- Shared CSS keyframes live in `src/index.css`; do not duplicate in `<style>` tags.
- Git workflow: feature branch → PR → squash merge to `main`. Branch name convention: `claude/<feature>-<hash>`.
- `statusLabels` (code → display name) is built in `App.tsx` from `fetchStatuses` and passed as a prop where needed (e.g. TLDV).
