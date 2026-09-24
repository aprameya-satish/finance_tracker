# Finance Tracker

Local household finance app: ingest Chase/Amex CSVs, sync cards with Plaid, auto-categorize from your history, budget by category, and split spend between A / S / shared.

## Run locally

Copy `.env.example` to `.env` and add Plaid keys when you are ready (sandbox works without live cards).

```bash
# backend
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. For the iPhone app, bind the API on the LAN and start Expo:

```bash
# backend reachable from a phone on the same Wi-Fi
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# iPhone client (third terminal)
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. Set the API URL in **More → Settings** if it does not pick up your computer automatically. Details are in [`mobile/README.md`](mobile/README.md).

Open http://localhost:5173. Import historical CSVs from Accounts, or:

```bash
python monthly_split_calculator.py --csv_directory "E:\finance\expense_tracking"
```

Plaid access tokens are encrypted at rest and never sent to the browser. SQLite lives in `data/` (gitignored).
