# Sharing VOICEGUARD — putting it "live" for your team

**The key constraint:** Netlify (and any static host) can serve the UI, but not
the AI backend — that needs a persistent Python process with ~2 GB of loaded
models, ffmpeg and a local SQLite file. So the pattern is:

```
Teammate's browser ──HTTPS──▶ Netlify (UI)  ──HTTPS──▶  backend (must be public too)
```

Three deployment options — two free, one with usage billing:

---

## Path A — backend on YOUR PC + Cloudflare Tunnel (works today, ~10 min)

Your laptop must be ON while teammates test. Best for "try it now".

1. **Expose the backend** (one command, gives you a public HTTPS URL):
   ```powershell
   winget install Cloudflare.cloudflared
   cloudflared tunnel --url http://127.0.0.1:8000
   ```
   Note the printed URL, e.g. `https://abc-def-ghi.trycloudflare.com`
   (random per run — keep the window open, and re-do steps 3-4 if it changes).

2. **Allow your Netlify site in the backend CORS** — restart the backend with:
   ```powershell
   $env:ALLOWED_ORIGINS = "https://<your-site>.netlify.app"
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_all.ps1
   ```

3. **Deploy the frontend to Netlify:**
   - Push this repo to GitHub → Netlify → "Add new site" → "Import an existing
     project" → pick the repo. Netlify reads `frontend/netlify.toml`
     (build: `npm run build`, publish: `dist`).
   - Site configuration → **Environment variables** → add:
     `VITE_API_URL = https://abc-def-ghi.trycloudflare.com` (from step 1)
   - **Deploys → Trigger deploy**. Done: share `https://<your-site>.netlify.app`.

4. Teammates open the link, hit Analyze, and your PC does the AI work.
   (Mic works because both ends are HTTPS.)

No-GitHub alternative: run `npm run build` in `frontend/`, then drag the
`frontend/dist` folder onto https://app.netlify.com/drop — but you must set
`VITE_API_URL` **before** building:
`$env:VITE_API_URL="https://abc-def-ghi.trycloudflare.com"; npm run build`.

---

## Path B — backend on Railway (GitHub-connected, auto-deploys on push)

Railway note: no permanent free tier. **Trial = $5 one-time credit** (no card);
after that Hobby is $5/mo **+ usage**. This backend holds ~2.5 GB of models, and
Railway bills RAM by the hour — **set a usage limit** (Service → Settings →
Limits) before deploying, and expect the trial to last days, not months. For a
genuinely free always-on backend use Path C.

1. **Add the deploy files** (already committed): `backend/Dockerfile` exists and
   `backend/db.py` accepts a `VOICEGUARD_DB_PATH` env override for volumes.
2. **railway.app** → sign in with GitHub → **New Project → Deploy from GitHub repo**
   → select `Mahipal1127/voiceguard`.
3. Service → **Settings**:
   - **Root Directory** = `backend`  ← important (the Dockerfile lives there)
   - **Healthcheck Path** = `/health`
4. **Variables** → add:
   - `ALLOWED_ORIGINS = https://YOUR-SITE.netlify.app`
   - (optional, with a Volume attached at `/data`) `VOICEGUARD_DB_PATH = /data/voiceguard.db`
5. **Settings → Networking → Generate Domain** → e.g.
   `https://voiceguard-backend-production.up.railway.app` (HTTPS included).
   Test: append `/health`.
6. **Netlify**: edit `frontend/public/voiceguard-config.json` →
   `"apiUrl": "https://voiceguard-backend-production.up.railway.app"` → commit +
   push. Railway auto-redeploys the backend on every push to `backend/`.

Bonus: because it's GitHub-connected, any `git push` that touches the backend
rebuilds and redeploys it automatically — no manual steps.

---

## Path C — backend as a free Hugging Face Space (always-on, 24/7)

Free tier: 16 GB RAM, 2 vCPU — comfortably runs all three models. Spaces sleep
after 48 h of zero traffic and wake on the next visit (first wake: models
re-download, ~2-4 min).

1. Create a **Hugging Face** account (free) → **New Space** → SDK: **Docker** →
   name it e.g. `voiceguard-backend` → Public.
2. Upload to the Space repo (web UI or git):
   - the **contents of `backend/`** (requirements.txt, main.py, db.py, routers/,
     services/) — at the **Space repo root**
   - `deploy/hf-space/Dockerfile` (at root)
   - `deploy/hf-space-readme.md` → rename to `README.md` (its front-matter
     tells HF it's a Docker Space on port 7860)
3. Space → **Settings → Variables and secrets** → add variable
   `ALLOWED_ORIGINS = https://<your-site>.netlify.app`
4. The Space builds and starts; models download on first boot (~2-4 min).
   Your backend URL: `https://<your-username>-voiceguard-backend.hf.space`
   (check it: append `/health`).
5. **Netlify**: set `VITE_API_URL` to that URL, re-deploy → share the link.

Teammates can now test 24/7. Note: the Space's SQLite DB and enrolled voices
are per-Space (fresh there — each teammate enrolls their own reference voice,
which is actually what you want for testing).

---

## Which path for SIH?

- **Judges demo (same room):** neither — run locally per `DEMO_SCRIPT.md`
  (zero network risk, fastest).
- **Team testing before the event:** Path B (Railway, simplest) or Path C
  (HF Space, free around the clock).
