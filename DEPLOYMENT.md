# Deployment — sharketfilter.xyz

## Architecture

```
filter_generation/data/**  (git = single source of truth)
        │  push to main
        ▼
GitHub Action (.github/workflows/deploy-pages.yml)
  1. create_demo_bundle.py  → bakes data into webapp/frontend/public/demo_data/
     (imports webapp/backend/main.py — same loaders/endpoints as local dev)
  2. npm run build:demo     → static Vite build, backend-free mode
  3. wrangler pages deploy  → Cloudflare Pages → https://sharketfilter.xyz
```

- **Regular users have no accounts.** All edits persist to the browser's
  localStorage (`demo_vfs_*` keys); the snapshot export/import gives file-based
  backup/share. `src/services/clientData.ts` re-implements every backend
  endpoint client-side over `bundle + localStorage` (keep it in sync with
  `webapp/backend/main.py` — local dev runs the Python versions).
- **Admins** sign in via the ⚙ Admin button (Supabase auth, invited accounts
  only) and submit their snapshot for review. The owner downloads it, reviews
  locally (ImportPanel + `git diff`), commits → the site redeploys itself.
- FastAPI (`webapp/backend/`) is **local development only** — never deployed.

## One-time setup

### Cloudflare (hosting + domain) — detailed

**Step 0 — account.** Sign up at https://dash.cloudflare.com/sign-up (free plan).

**Step 1 — get the domain onto Cloudflare DNS.**
- *Bought at Cloudflare Registrar:* nothing to do — it's already on Cloudflare.
- *Bought elsewhere (Namecheap/GoDaddy/...):* dashboard → **Add a site** →
  enter `sharketfilter.xyz` → choose the **Free** plan → Cloudflare shows two
  nameservers (like `xxx.ns.cloudflare.com`). Log in at your registrar, find
  the domain's **Nameservers** setting, replace the existing ones with those
  two, save. Activation takes minutes to ~24h; Cloudflare emails you when the
  site turns **Active**. (You can do steps 2–4 while waiting.)

**Step 2 — create the Pages project.** The CI deploy needs the project to
already exist, with this exact name: **`sharketfilter`**.
- Dashboard left menu → **Workers & Pages** → **Create** → **Pages** tab →
  **Upload assets** (a.k.a. Direct Upload — do NOT pick "Connect to Git";
  our GitHub Action does the building).
- Project name: `sharketfilter` → **Create project**.
- It now insists on a first upload: drag in any single placeholder file
  (e.g. an empty `index.html`) → **Deploy site**. The first real CI deploy
  replaces it.

**Step 3 — attach the domain.**
- Open the `sharketfilter` Pages project → **Custom domains** tab →
  **Set up a custom domain** → enter `sharketfilter.xyz` → Continue.
  Because the domain's DNS is on Cloudflare (step 1), it creates the record
  automatically and the domain goes Active after a short verification.
- Repeat for `www.sharketfilter.xyz` if you want `www` to work too.

**Step 4 — API token + account ID for GitHub.**
- Token: click the **profile icon (top right) → My Profile → API Tokens →
  Create Token → Custom token**:
  - Name: `github-pages-deploy`
  - Permissions: **Account → Cloudflare Pages → Edit** (that single row is enough)
  - Account Resources: Include → your account
  - **Continue to summary → Create Token** → COPY it now (it's shown once).
- Account ID: **Workers & Pages** overview page, right-hand sidebar →
  **Account ID** (a 32-char hex string) → copy.

**Step 5 — put both into GitHub.**
- GitHub repo → **Settings → Secrets and variables → Actions** →
  **Secrets** tab → **New repository secret**:
  - Name `CLOUDFLARE_API_TOKEN`, value = the token from step 4.
  - Name `CLOUDFLARE_ACCOUNT_ID`, value = the account ID.
  (The Supabase values go under the **Variables** tab instead — see below.)

**Step 6 — first deploy.** Merge the deployment branch into `main` and push —
or trigger manually: repo → **Actions** tab → "Deploy to Cloudflare Pages
(sharketfilter.xyz)" → **Run workflow**. Watch the run go green, then open
https://sharketfilter.xyz.

Troubleshooting:
- `Project not found` in the deploy step → the Pages project name isn't
  exactly `sharketfilter` (must match `--project-name` in deploy-pages.yml).
- `Authentication error (code 10000)` → token missing the
  `Cloudflare Pages: Edit` permission or wrong account selected.
- Domain shows Cloudflare's "not found" page → Custom domains tab still
  verifying, or step 1 nameserver change hasn't propagated yet.

### Supabase (admin inbox)

1. Create a free project at supabase.com — **region: Singapore** (closest to CN).
2. **Authentication → Sign In / Up**: disable "Allow new users to sign up".
   Invite admins via **Authentication → Users → Add user** (email + password;
   tell them to change it after first login, or use "Send invitation").
3. **Authentication → URL Configuration**: Site URL `https://sharketfilter.xyz`.
4. **SQL Editor** → run:

```sql
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  author_email text,
  title text not null,
  note text,
  snapshot text not null,                  -- gzip+base64 snapshot JSON
  status text not null default 'pending',  -- pending | approved | rejected
  created_at timestamptz not null default now()
);
alter table public.submissions enable row level security;
create policy "insert own" on public.submissions
  for insert with check (auth.uid() = user_id);
create policy "read own" on public.submissions
  for select using (auth.uid() = user_id);
create policy "owner read" on public.submissions
  for select using (auth.jwt()->>'email' = 'shiningingzili@gmail.com');
create policy "owner update" on public.submissions
  for update using (auth.jwt()->>'email' = 'shiningingzili@gmail.com');
```

5. GitHub repo → **Settings → Secrets and variables → Actions → Variables**
   (the *Variables* tab, NOT Secrets — these are public-by-design values):
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — the **publishable key** (`sb_publishable_...`),
     Project Settings → API Keys. Supabase renamed these in 2025: the old
     "anon" JWT is now legacy; the publishable key is its successor and works
     identically with supabase-js. Safe to expose; RLS protects the data.
     Never use the secret key (`sb_secret_...`) in the frontend.

   Without these variables the build still works — the Admin button is simply
   hidden (that's also why local dev and the GH Pages preview show no admin UI).

### Web Analytics (visits, countries — free, cookieless)

Cloudflare dashboard → **Web Analytics** → **Add a site** → choose the Pages
project / enter `sharketfilter.xyz`. For Pages projects Cloudflare can inject
the measurement beacon automatically (Pages project → **Settings → Web
Analytics → Enable**) — no code change needed. Stats appear under Web
Analytics in the dashboard after the next visits.

If auto-injection isn't available for the setup, copy the site's beacon token
and add the snippet to `webapp/frontend/index.html` instead:
`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "<TOKEN>"}'></script>`

## The contribution loop

1. Admin edits the filter on sharketfilter.xyz (their edits live in their browser).
2. Admin: ⚙ Admin → sign in → "Submit changes for review" (title + note).
3. Owner: ⚙ Admin → sign in → submission list → **⬇ Snapshot** to download.
4. Owner reviews locally: run the local app, Export view → Import / Restore →
   load the downloaded `.snapshot.json`, select categories → import → `git diff`
   shows exactly what changed (the import backs up overwritten files to
   `filter_generation/data/_import_backup/`).
5. Keep what's good, commit, push to `main` → the deploy workflow rebakes the
   bundle and redeploys → mark the submission **Approved**.

## Free-tier notes

- **Supabase pauses projects after ~7 days without traffic** (free tier).
  One-click restore in the dashboard. The admin inbox tolerates this — restore
  it when you expect submissions, or add a weekly keep-alive ping if it annoys.
- Cloudflare Pages free: unlimited static bandwidth/requests, 500 builds/month —
  far above our usage. We build in GitHub Actions, so build minutes there
  (free for public repos) are what's consumed.
- Total running cost: the domain (~$10/yr).

## Local development (unchanged)

```
uvicorn main:app --reload   # in webapp/backend (FastAPI writes data files)
npm run dev                 # in webapp/frontend (proxies /api to :8000)
```

To test the deployed behavior locally:

```
python filter_generation/create_demo_bundle.py
cd webapp/frontend && npm run build:demo && npx vite preview
```
