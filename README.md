# Vinyl Investigator

A phone-first PWA for double-checking your sub-$10 vinyl "discard pile" against Discogs marketplace data, flagging records whose pressings might be worth investigating, and deep-linking to eBay Sold / Terapeak research for manual verification.

## What it does

1. Snap a cover photo (or type the artist/title manually).
2. Backend identifies the album with Gemini 2.0 Flash, then looks up every known pressing on Discogs with median/low/high marketplace prices.
3. If the highest-valued pressing exceeds your threshold (default $10, editable), the record is flagged as "investigate further."
4. For flagged records: shoot a dead-wax photo *or* type the matrix/runout string. The app shows OCR'd / typed text next to the list of Discogs pressings so you can match by eye.
5. Three deep-link buttons per record: **eBay Sold** (price high to low), **eBay Terapeak Research**, **Discogs marketplace**. You click through to verify.

Scan history is stored locally in IndexedDB. No accounts. No server-side database.

## Architecture

```
┌───────────────────────────┐         ┌──────────────────────────┐
│  SvelteKit PWA            │  HTTPS  │  Cloudflare Worker        │
│  Hosted on GitHub Pages   │ ──────▶ │  /identify  (Gemini)      │
│  (static, free)           │         │  /lookup    (Discogs)     │
│                           │         │  /matrix    (Gemini OCR)  │
│  IndexedDB scan history   │         │  Free up to 100k req/day  │
└───────────────────────────┘         └──────────────────────────┘
```

Frontend has no secrets. Both API keys (Gemini, Discogs) live in the Worker's environment variables.

## Cost

For personal use: **$0/month.** GitHub Pages, Cloudflare Workers free tier, Gemini 2.0 Flash free tier (1,500 req/day), and Discogs API (free) all comfortably cover hundreds of scans per day.

## Repository layout

```
VinylInvestigator/
├── frontend/                  SvelteKit PWA → GitHub Pages
│   ├── src/
│   │   ├── routes/            App pages
│   │   ├── lib/               Components, stores, API client, helpers
│   │   └── service-worker.js  Offline shell
│   ├── static/                manifest.webmanifest, icons
│   ├── svelte.config.js       adapter-static config
│   └── vite.config.js
├── worker/                    Cloudflare Worker → workers.dev
│   ├── src/index.js           /identify, /lookup, /matrix
│   └── wrangler.toml
├── .github/workflows/
│   └── deploy.yml             Build & publish frontend on push
└── README.md
```

## Setup

### Prerequisites

- Node 20+
- A Discogs personal access token: https://www.discogs.com/settings/developers
- A Gemini API key: https://aistudio.google.com/app/apikey
- A Cloudflare account (free tier): https://dash.cloudflare.com/sign-up

### Worker (backend)

```bash
cd worker
npm install
npx wrangler login
# Set secrets (they are NEVER committed):
npx wrangler secret put DISCOGS_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

After deploy, copy the URL Wrangler prints (e.g. `https://vinyl-investigator-worker.YOURNAME.workers.dev`). You'll paste it into the frontend env in the next step.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: set PUBLIC_WORKER_URL to the URL Wrangler printed above
npm run dev
```

Open the printed localhost URL on your phone (same wifi network, use your laptop's LAN IP) to test the camera flow.

### GitHub Pages deployment

1. Push the repo to GitHub.
2. Repo settings → Pages → Source: **GitHub Actions**.
3. Edit `frontend/svelte.config.js` and set `paths.base` to `/your-repo-name` (only needed if the repo is published at `username.github.io/your-repo-name`; leave blank for a user/org page).
4. In repo settings → Secrets and variables → Actions → New repository variable, add `PUBLIC_WORKER_URL` set to your Worker URL.
5. Push to `main`. The Actions workflow builds and deploys automatically.

### Add to home screen (PWA install)

On the deployed site, Safari/Chrome will offer "Add to Home Screen." Once installed it opens full-screen like a native app, persists scan history, and works offline for the app shell (scans still need a network call to the Worker).

## Usage notes

- **Threshold** lives in app Settings, default $10. Stored in `localStorage`.
- **Matrix/runout input** has two flavors per the design: shoot a dead-wax photo, or type it in. Use whichever is easier in the moment — typing is often more accurate.
- **eBay deep links** use `_sop=16` (price high to low). Terapeak research requires being signed into eBay Seller Hub.

## License

Personal project. MIT.
