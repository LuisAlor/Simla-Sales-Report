# Simla CRM Analytics Dashboard — Project Knowledge

## Project Purpose

Sales analytics dashboard that queries Simla CRM data (orders, revenue, managers, customers) and visualises KPIs. Includes a TLDV demo-call analysis module with AI-powered transcript analysis.

---

## Repository Layout

```
web/                        React SPA (the main app)
  src/
    pages/
      Analytics.tsx         Main analytics dashboard (orders/revenue/KPIs)
      Funnel.tsx            Sales funnel analysis
      TLDV.tsx              Demo-call analysis (TLDV + OpenAI)
      AdminPanel.tsx        Settings: users, integrations, API keys
      Profile.tsx           User profile + preferences
      Login.tsx / ApiSetup.tsx
    components/
      TopFilters.tsx        Horizontal filter bar used by Analytics/Funnel
      DateRangePicker.tsx   Unified date picker (calendar + relative presets)
      MultiSelect.tsx       Dark-variant multi-select (used in TLDV filters)
      Sidebar.tsx           Navigation sidebar
      LoadingScreen.tsx     Animated full-page loading state
    contexts/
      AuthContext.tsx       User auth + profile persistence (localStorage)
      NavigationGuardContext.tsx  Unsaved-changes guard (intercepts nav, shows dialog)
      I18nContext.tsx       Language selection (ES/EN/RU)
      ThemeContext.tsx      Light/dark/auto theme
    lib/
      api.ts                Simla REST v5 fetchers (orders, statuses, dict options)
      tldvApi.ts            TLDV transcript fetcher
      openai.ts             OpenAI chat completions wrapper
      i18n.ts               All translation strings (ES/EN/RU)
      auth.ts               User model + localStorage persistence
      filters.ts            Filter state types
      transforms.ts         Data aggregation (revenue, funnel, top products)
      flatten.ts            Order → flat record mapper
      ordersCache.ts        localStorage cache for fetched order data
```

---

## Tech Stack

| Layer       | Choice                  |
|-------------|-------------------------|
| UI          | React 18 + TypeScript   |
| Build       | Vite                    |
| Styling     | Tailwind CSS            |
| Routing     | React Router v6 (BrowserRouter — NOT data router) |
| Data        | TanStack Query v5       |
| Charts      | Recharts                |
| Date util   | dayjs                   |
| Icons       | lucide-react            |

---

## Simla REST v5 API

**Base URL:** `https://<store>.simla.com/api/v5/`  
**Auth:** `?apiKey=<token>` query param

### Key endpoints used

| Endpoint                  | Purpose                               |
|---------------------------|---------------------------------------|
| `GET /api/v5/orders`      | Order list with full fields           |
| `GET /api/v5/statuses`    | Order status codes + labels           |
| `GET /api/v5/order-types` | Order type slugs + labels             |
| `GET /api/v5/users`       | Manager list                          |
| `GET /api/v5/custom-fields` | Custom field dictionary options     |

### Pagination

```json
{ "pagination": { "limit": 100, "totalCount": 450, "currentPage": 1, "totalPageCount": 5 } }
```

Iterate `page` 1 → `totalPageCount`.

### Custom fields used in TLDV module

| Field key       | Content                                  |
|-----------------|------------------------------------------|
| `demo_date`     | Date of the demo call (ISO string)       |
| `manager_sd`    | Manager code (object `{code, name}`)     |
| `name_komp_z`   | Project/company name                     |
| `mql_order`     | MQL flag (`yes`/`no`/`1`/`0`)            |
| `tldv_video`    | TLDV meeting URL                         |

Use `cfCode(customFields, key)` in TLDV.tsx to safely extract `code ?? name` from object-typed custom fields.

---

## TLDV Module

- Fetches orders that have a demo date → groups by TLDV URL → renders transcripts via `tldvApi.ts`
- AI analysis via OpenAI (`callOpenAI` in `lib/openai.ts`), cached in localStorage keyed by `lang_meetingId`
- Language of AI report is enforced by appending `IMPORTANT: Write your entire response in <lang>.` to the system prompt
- Manager filter uses persistent `knownManagers` state that grows across reloads (never cleared)

---

## Navigation Guard

`NavigationGuardContext` intercepts all in-app navigation via `requestNavigate(to)`. Any page with unsaved changes calls `setIsDirty(true)` and cleans up on unmount. Shows a discard/keep dialog before navigating away. Works with `BrowserRouter` (not data router — `useBlocker` was removed).

---

## i18n

All user-visible strings go through `t(key)` from `useT()`. Keys defined in `web/src/lib/i18n.ts` for ES (default), EN, RU. When adding a feature, add all three language entries.

---

## Code Conventions

- API calls only in `lib/api.ts`, `lib/tldvApi.ts`, `lib/openai.ts` — never fetch directly from pages.
- Pagination handled inside fetchers; callers receive flat arrays.
- Monetary values stay as `number`; format only at display time.
- Dates from API are ISO 8601 strings; use `dayjs` for display formatting.
- Hard-coded user-visible strings are a bug — always use `t(key)`.
- Shared CSS keyframes live in `src/index.css`; do not duplicate in `<style>` tags.
- `useMemo` for any `.find()`, `.filter()`, or derived computation used in render.
- Git workflow: feature branch → PR → squash merge to `main`.
