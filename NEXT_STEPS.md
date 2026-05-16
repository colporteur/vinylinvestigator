# Next steps — getting Vinyl Investigator running

Quick reference for the order of operations. Detailed reasoning is in `README.md`.

## 1. One-time accounts

- Discogs personal access token → https://www.discogs.com/settings/developers
- Gemini API key → https://aistudio.google.com/app/apikey
- Cloudflare free account → https://dash.cloudflare.com/sign-up

## 2. Local install

```bash
cd VinylInvestigator/frontend
npm install

cd ../worker
npm install
```

## 3. Deploy the Worker first

The frontend needs the Worker's public URL.

```bash
cd worker
npx wrangler login              # opens browser, authorizes CLI
npx wrangler secret put DISCOGS_TOKEN     # paste your Discogs token when prompted
npx wrangler secret put GEMINI_API_KEY    # paste your Gemini key
npx wrangler deploy
```

Wrangler will print something like:
```
Published vinyl-investigator-worker
  https://vinyl-investigator-worker.YOUR-SUBDOMAIN.workers.dev
```

Copy that URL. Also edit `worker/wrangler.toml` and update `ALLOWED_ORIGINS` to include your final GitHub Pages URL (and re-deploy).

## 4. Local frontend test

```bash
cd frontend
cp .env.example .env
# Edit .env: set PUBLIC_WORKER_URL to the Worker URL from step 3
npm run dev
```

It will print a `Network:` URL with your LAN IP — open that on your phone (same wifi) to test the camera flow. If the phone refuses the file capture, the OS file picker still works.

## 5. Push to GitHub

```bash
cd VinylInvestigator
git init
git add .
git commit -m "Initial scaffold"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## 6. Configure GitHub Pages

1. Repo Settings → Pages → Build and deployment → Source: **GitHub Actions**
2. Repo Settings → Secrets and variables → Actions → Variables tab → New repository variable:
   - `PUBLIC_WORKER_URL` = your Worker URL from step 3
   - (Only if project page) `BASE_PATH` = `/YOUR-REPO` (e.g. `/vinyl-investigator`)
3. The `deploy.yml` workflow will run on the next push to `main` (or trigger manually under the Actions tab).

After the workflow finishes, your site is at `https://YOUR-USERNAME.github.io/YOUR-REPO/`. Open it on your phone and tap "Add to Home Screen."

## 7. Generate icons (one-time)

The PWA install prompt needs `icon-192.png` and `icon-512.png` in `frontend/static/`. The simplest path:

- Open `frontend/static/favicon.svg` in any image editor
- Export at 192×192 and 512×512
- Save the two PNGs into `frontend/static/`

Or use https://realfavicongenerator.net to do it in one upload.

## Future enhancements (not in v1)

- Multi-record capture (4–8 covers per photo) — needs vision-side bounding boxes
- Automatic matrix → pressing matching
- Discogs price suggestions (condition-based) instead of just lowest-for-sale
- Worker KV cache by release_id to reduce Discogs calls on repeat scans
- VinylSnap delta comparison
