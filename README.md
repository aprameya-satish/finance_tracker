# Finance Tracker

Household finance app: Chase/Amex CSV ingest, Plaid live pull, auto-categorize from your labels, budgets, and A / S / shared split.

## Use it on an iPhone

Open this site in Safari, then **Share → Add to Home Screen**.

**https://aprameya-satish.github.io/finance_tracker/**

CSV uploads, Who labels, budgets, and reports stay on the phone. Live bank linking needs a **hosted Plaid API** (Plaid secrets cannot live in the browser).

### Link a bank from the phone

1. Deploy the FastAPI backend (Render blueprint in `render.yaml`, or any Docker host).
2. In the Plaid dashboard, add redirect URIs:
   - `https://aprameya-satish.github.io/finance_tracker/accounts`
   - `https://cdn.plaid.com/link/v2/stable/oauth.html` (Expo WebView)
   - `http://localhost:5173/accounts` (local web)
3. Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` or `production`), and `PLAID_REDIRECT_URI` on the host. Production is required for live Chase/Amex.
4. Optionally set `API_SHARED_SECRET` so only your phone can call `/api/plaid/*`.
5. In the app: **Settings → Plaid API URL** (and API key if you set one) → **Test Plaid API**.
6. **Accounts → Link bank**, then **Sync accounts**. Statements merge into on-device storage. Your Who / category labels are never overwritten.

If Pages 404s, repo **Settings → Pages**: Deploy from a branch, `main`, `/docs` — or run **Deploy phone app** in Actions.

## Optional: computer + API

Copy `.env.example` to `.env` and fill Plaid keys.

```bash
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

cd frontend
npm install
npm run dev
```

```bash
python monthly_split_calculator.py --csv_directory "E:\finance\expense_tracking"
```

Plaid access tokens are encrypted at rest and never sent to the browser. Hosted SQLite lives on the API disk; the phone app keeps its own copy after each snapshot pull.

## Host the Plaid API

```bash
docker build -t finance-tracker-api .
docker run --env-file .env -p 8000:8000 finance-tracker-api
```

Or connect the repo to Render with `render.yaml`. Set `CORS_ORIGINS` to include `https://aprameya-satish.github.io`.
