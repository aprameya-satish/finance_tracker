# Finance Tracker

Household finance app: Chase/Amex CSV ingest, auto-categorize from your labels, budgets, and A / S / shared split.

## Use it on an iPhone (no computer)

The app now runs **entirely on the phone**. Open this site in Safari, then **Share → Add to Home Screen**.

After GitHub Pages is enabled on this repo, the address is:

**https://aprameya-satish.github.io/finance_tracker/**

From the GitHub iOS app: repo → Settings (or the website) → Pages → Deploy from GitHub Actions (or `/docs`).

Then:

1. Upload statement CSVs from the Files app (Accounts).
2. Edit Who / category on Activity or Split.
3. Export a backup from Settings if you change phones.

Data stays in that home-screen app. Clearing Safari data can delete it — keep a backup.

## Optional: computer + API

Copy `.env.example` to `.env` for Plaid keys if you later want live bank sync on a computer.

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

Plaid access tokens are encrypted at rest and never sent to the browser. SQLite on a computer lives in `data/` (gitignored). The phone app uses on-device storage instead.
