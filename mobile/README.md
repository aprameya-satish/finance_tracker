# Finance iPhone app

Expo/React Native client for the same FastAPI backend as the web app. Same household split, budgets, CSV ingest, review queue, and Plaid hooks — laid out for iPhone with a tab bar.

## What it covers

- **Overview** — month total, A / S / shared chips, category bars, budget exceedances, PDF share
- **Activity** — search, who/account/category filters, inline Who and category edits
- **Review** — low-confidence queue (More → Review)
- **Budgets** — limits, copy previous month, include-pending
- **Split** — settlement (`A + shared/2`), edit Who, PDF share
- **Accounts** — Files-picker CSV upload, folder import (path is on the API host), Plaid Link + sync
- **Investments** — empty harness
- **Settings** — API URL, people labels, categories

The iPhone never holds Plaid tokens. It talks to `POST /api/plaid/link-token` and `/exchange` only.

## Run on an iPhone

1. Start the backend so the phone can reach it:

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. Start Expo:

```bash
cd mobile
npm install
npx expo start
```

3. Install **Expo Go** on the iPhone, then scan the QR code.
4. Open **More → Settings**. The API URL defaults to your computer’s LAN IP (`http://<lan-ip>:8000`) when you launch from Expo. Tap **Save & test connection**.

The phone and the computer must be on the same Wi-Fi. iOS local networking is allowed in `app.json`.

## Native iOS build later

```bash
npx expo prebuild --platform ios
npx expo run:ios
```

That step needs a Mac with Xcode. Expo Go is enough for day-to-day use.
