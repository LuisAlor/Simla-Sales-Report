# Simla CRM Analytics Dashboard

An analytics dashboard that queries Simla CRM order data and visualises sales KPIs.

## Features

- Revenue over time (daily / weekly / monthly)
- Orders by status
- Revenue & order count by manager
- Top products by revenue
- Gross margin tracking
- Repeat customer analysis

## Quick start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
# edit .env with your SIMLA_STORE and SIMLA_API_KEY

# 3. Run the dashboard
streamlit run src/dashboard/app.py
```

Or enter credentials directly in the sidebar when the app opens.

## API used

| API      | Endpoint                                      |
|----------|-----------------------------------------------|
| REST v5  | `https://<store>.simla.com/api/v5/orders`     |
| REST v5  | `https://<store>.simla.com/api/v5/users`      |
| REST v5  | `https://<store>.simla.com/api/v5/statuses`   |

See [CLAUDE.md](CLAUDE.md) for the full API knowledge base.
