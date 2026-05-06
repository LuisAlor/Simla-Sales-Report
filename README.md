# Simla CRM Analytics Dashboard

A real-time sales analytics dashboard that connects to [Simla CRM](https://simla.com) (RetailCRM) via REST v5 API and visualises order data, revenue trends, manager performance, funnel stages and UTM attribution — all in a React single-page application.

## Features

- **Revenue & Orders over time** — daily / weekly / monthly line and bar charts
- **Orders by status** — donut chart with CRM status labels
- **Manager performance** — revenue and order count per sales advisor
- **Top products** — horizontal bar chart ranked by revenue
- **Funnel analysis** — key stages, negative stages, and post-sale stages with cohort tracking
- **UTM attribution** — filter by source and medium to measure campaign ROI
- **Filter templates** — save and restore named filter combinations (e.g. "Last Quarter — License only")
- **30-minute localStorage cache** — repeat loads return instantly; clicking "Cargar datos" always re-fetches
- **Dark / Light / Auto theme** — Sun / Moon / Monitor toggle; respects `prefers-color-scheme` in auto mode
- **Multi-user auth** — admin and viewer roles, per-user API keys stored locally

## Tech Stack

| Layer | Choice |
|---|---|
| UI framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 3 (`darkMode: "class"`) |
| Charts | Apache ECharts via `echarts-for-react` |
| Data fetching | TanStack Query v5 |
| Table | TanStack Table v8 |
| Routing | React Router v6 |
| Date utilities | Day.js |

## Prerequisites

- Node.js 18 or later
- A Simla CRM account with a REST v5 API Key

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/luisalor/simla-sales-report.git
cd simla-sales-report/web

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## First-time Setup

1. Log in with the default admin credentials (set up on first load).
2. Go to **Admin → Configuración → API Key de Simla CRM** and paste your REST v5 API Key — the app validates it live against the Simla API.
3. Return to the main dashboard, select a date range and order types, then click **Cargar datos**.

> Your API Key is stored only in `localStorage` and sent directly to `<your-store>.simla.com` — never to any third-party server.

To find your key: Simla CRM → Settings → API Keys → REST API.

## Build for Production

```bash
cd web
npm run build
# Static output in web/dist/ — deploy to Vercel, Netlify, Nginx, or any static host
```

## Project Structure

```
web/src/
├── components/        # Charts, filters, table, sidebar, date picker…
│   └── charts/        # ECharts wrappers (Revenue, Orders, Status, Manager, Products…)
├── contexts/          # AuthContext, ThemeContext
├── lib/               # API client, data transforms, localStorage cache, utils
└── pages/             # Analytics, Funnel, AdminPanel, Profile, Login, ApiSetup
```

## Simla API Used

| Method | Endpoint |
|---|---|
| GET | `/api/v5/orders` — paginated order list with manager, customer, items |
| GET | `/api/v5/users` — sales managers |
| GET | `/api/v5/statuses` — order status labels |
| GET | `/api/v5/order-types` — order type slugs |
| GET | `/api/v5/custom-fields/dictionaries/{code}` — custom field dictionary values |

See [CLAUDE.md](CLAUDE.md) for the full API reference used during development.

## License

MIT
