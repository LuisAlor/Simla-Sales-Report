# Simla CRM Analytics Dashboard — Project Knowledge

## Project Purpose

Build an analytics dashboard that queries Simla CRM data (orders, revenue, managers, customers)
and visualises KPIs. This is NOT a ticket/support tool — focus is purely on sales analytics.

---

## Simla API Overview

| API        | Base URL pattern                              | Auth                              |
|------------|-----------------------------------------------|-----------------------------------|
| REST v5    | `https://<store>.simla.com/api/v5/...`        | `?apiKey=<token>` query param     |
| GraphQL    | `https://<store>.simla.com/app/api`           | `Authorization: Bearer <token>`   |
| MG Bot v1  | `https://mg-s1.retailcrm.pro/api/bot/v1/...`  | `X-Bot-Token: <token>` header     |

> For this dashboard only REST v5 and GraphQL are needed. MG Bot is messaging-only.

---

## REST v5 — Orders Endpoint (Core)

**Endpoint:** `GET /api/v5/orders`

### Filter parameters

| Param            | Type     | Description                                 |
|------------------|----------|---------------------------------------------|
| `createdAtFrom`  | datetime | Start of date range (ISO 8601)              |
| `createdAtTo`    | datetime | End of date range (ISO 8601)                |
| `orderType`      | string   | Order type slug                             |
| `status`         | string   | Order status code                           |
| `managerId`      | int      | Filter by responsible manager               |
| `page`           | int      | Page number (1-based)                       |
| `limit`          | int      | Results per page (max 100)                  |

### Pagination

Response includes a `pagination` block:

```json
{
  "pagination": {
    "limit": 20,
    "totalCount": 450,
    "currentPage": 1,
    "totalPageCount": 23
  }
}
```

Iterate pages from `1` to `pagination.totalPageCount` to collect all records.

### Order object — key fields for analytics

```
order.id                         — unique order ID
order.number                     — human-readable order number
order.createdAt                  — creation timestamp
order.status                     — status code (string)
order.orderType                  — order type slug

# Revenue
order.summ                       — order total (goods)
order.totalSumm                  — total including shipping/discounts
order.prepaySum                  — amount pre-paid
order.purchaseSumm               — cost of goods (for margin calc)

# Manager / ownership
order.managerId                  — assigned manager ID
order.manager.id
order.manager.firstName
order.manager.lastName

# Customer
order.customer.id
order.customer.firstName
order.customer.lastName
order.customer.email
order.customer.phone

# Line items
order.items[]
  .id
  .productName
  .quantity
  .initialPrice          — unit price before discounts
  .discountPercent
  .purchasePrice         — cost price

# Custom fields
order.customFields{}     — dict of site-defined custom field values
```

---

## REST v5 — Other Useful Endpoints

| Endpoint                  | Purpose                                      |
|---------------------------|----------------------------------------------|
| `GET /api/v5/statuses`    | List all order status codes + labels         |
| `GET /api/v5/order-types` | List all order type slugs + labels           |
| `GET /api/v5/users`       | List managers (id, firstName, lastName)      |
| `GET /api/v5/customers`   | Customer list with segments                  |

---

## GraphQL API

Base URL: `https://<store>.simla.com/app/api`  
Auth header: `Authorization: Bearer <token>`  
Content-Type: `application/json`

Used for complex aggregations or relationship queries not easily expressed in REST v5.
Prefer REST v5 for order data — GraphQL for metadata/reference lookups when needed.

---

## Authentication Setup

Store credentials in `.env` (never commit):

```
SIMLA_STORE=mystore          # subdomain only, e.g. "mystore" → mystore.simla.com
SIMLA_API_KEY=xxxx           # REST v5 apiKey
SIMLA_GRAPHQL_TOKEN=xxxx     # Bearer token for GraphQL (optional)
```

---

## Analytics KPIs to Track

- **Revenue over time** — daily / weekly / monthly `totalSumm`
- **Orders by status** — breakdown of order counts per status
- **Orders by manager** — revenue and count per manager
- **Average order value** — `totalSumm` / order count
- **Margin** — `totalSumm - purchaseSumm` aggregated
- **Top products** — line item aggregation by `productName`
- **Repeat customers** — customers with > 1 order

---

## Tech Stack

| Layer       | Choice         | Reason                                      |
|-------------|----------------|---------------------------------------------|
| Dashboard   | Streamlit      | Fast analytics UI, Python-native            |
| HTTP client | httpx          | Async-capable, cleaner than requests        |
| Data        | pandas         | Aggregation, groupby, resampling            |
| Charts      | plotly         | Interactive charts in Streamlit             |
| Config      | python-dotenv  | .env loading                                |

---

## Code Conventions

- All API calls go through `src/api/client.py` — never call `httpx` directly from UI code.
- Pagination is handled inside the fetcher, callers receive a flat list.
- Monetary values are floats in the API; keep them as `float`, format only at display time.
- Dates from the API are ISO 8601 strings — parse with `pd.to_datetime`.
