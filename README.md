# Finance Tracker

Household finance app: Chase/Amex CSV ingest, auto-categorize from your labels, budgets, and A / S / shared split.

## Use it on an iPhone (no computer)

The app now runs **entirely on the phone**. Open this site in Safari, then **Share → Add to Home Screen**.

The address is **not an IP**. Use this URL in Safari:

**https://aprameya-satish.github.io/finance_tracker/**

If that page 404s, Pages is enabled but nothing has been published yet. The first GitHub Action deploy failed because Pages was still off. Fix it in the repo **Settings → Pages**:

1. Under **Build and deployment → Source**, choose **Deploy from a branch**.
2. Branch: `main`
3. Folder: `/docs`
4. Save

Wait a minute, then open the URL above again. Do **not** look for a numeric IP.

Alternatively, leave Source as **GitHub Actions** and run the **Deploy phone app** workflow once (Actions tab → Deploy phone app → Run workflow).

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
