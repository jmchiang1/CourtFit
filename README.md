# Kotofit Facility Analyzer

A web app that decides whether a commercial warehouse listing is worth pursuing as a Kotofit-style indoor badminton/pickleball facility — in under a minute, before you call a broker.

**Live:** https://sports-complex-calc.vercel.app/

Paste a LoopNet URL → it pulls the page → AI extracts size, ceiling height, rent, zoning → the calculator returns a verdict (Strong Candidate / Worth Investigating / Risky / Do Not Pursue) with court counts, NOI, payback, and a risk-flag list.

---

## What it answers

For any property, in one screen:

1. **Is this physically viable?** — how many badminton and pickleball courts fit, given the warehouse sqft and a 60/40 court mix
2. **Is this financially viable?** — gross revenue, operating expenses, NOI margin, rent burden, payback period at mid-tier renovation cost
3. **What do I still need to confirm?** — flagged risks (low ceilings, rent missing, zoning unverified, etc.)

It uses the Kotofit franchise model assumptions out of the box:
- 6-court target (3 badminton + 3 pickleball)
- 1,250 sf per badminton court, 1,800 sf per pickleball court (incl. runoff)
- 80% of warehouse area usable
- $45/hr badminton, $55/hr pickleball, 42/38 reserved hrs/week
- 7% royalty, $40K franchise fee, $28/sf mid renovation
- Every number is editable in the Assumptions panel

---

## Features

- **AI extraction from pasted text** (Claude Haiku 4.5, forced tool-use + Zod validation)
- **URL ingestion via Jina Reader** — paste a listing URL, the server fetches and parses it
- **Bookmarklet** for sites that block server-side fetchers (LoopNet's Akamai, etc.) — runs in your browser, auto-extracts on arrival, reuses an existing app tab if one is open
- **Regex fallback parser** when AI isn't available
- **Deterministic-template summary** as a fallback for the AI summary
- **Editable assumptions** — all 23 model parameters
- **Saved properties** via Supabase + Google sign-in (Supabase OAuth)
- **Floor plans** — a top-level tab: draw courts, rooms, and furniture to scale in a
  full-screen planner, then save, rename, duplicate, and re-edit plans. A new plan can
  size its envelope from any saved listing's square footage and clear height.
- **JSON export**

---

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local   # then fill in keys (see below)
npm run dev
```

Open http://localhost:3000.

The app works without any keys — you'll just get the regex parser instead of AI extraction, and a templated summary instead of the AI one.

### Environment variables

```env
ANTHROPIC_API_KEY=sk-ant-...                    # optional; unlocks AI extraction + summary
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co # optional; unlocks save/load
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...             # optional; unlocks save/load
```

`SUPABASE_SERVICE_ROLE_KEY` is in `.env.local.example` but unused in v1.

### Supabase setup (only if you want save/load)

1. Create a project at https://supabase.com
2. SQL Editor → run every file in `supabase/migrations/` in filename order (`0001_properties.sql` first)
3. Authentication → URL Configuration → add `http://localhost:3000/api/auth/callback` (and your production URL's callback) to Redirect URLs
4. Google Cloud Console → APIs & Services → Credentials → create an OAuth client ID (Web application) with authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
5. Supabase → Authentication → Sign In / Providers → Google → enable it and paste the client ID and secret

---

## Bookmarklet

For LoopNet and other CRE sites, server-side fetches get blocked by Akamai/Cloudflare. The bookmarklet runs in your already-logged-in browser, so the site sees a normal user.

1. On the running app, expand the **Bookmarklet** card
2. Drag the "📌 Save to Kotofit" link to your bookmarks bar (drag-to-bookmark; right-click → Edit if you want to verify the URL starts with `javascript:`)
3. Browse to any LoopNet listing
4. Click the bookmark — text scrapes from the page, opens a new tab to the app, auto-extracts

The bookmarklet bakes in the app origin at drag time. Re-drag from each environment you use (localhost, production, preview).

The bookmarklet targets a named tab `kotofit-app`, so subsequent clicks focus and reuse the existing tab instead of stacking new ones.

---

## Deploy

Push to GitHub, then:

```bash
npm install -g vercel
vercel
```

After first deploy, set the env vars in the Vercel dashboard → Project → Settings → Environment Variables. Then redeploy:

```bash
vercel --prod
```

Add `https://<your-domain>.vercel.app/api/auth/callback` to Supabase's allowed redirect URLs.

GitHub Pages, S3, Netlify-static, etc. won't work — the app uses Next.js Server Actions and route handlers that need a Node runtime.

---

## Architecture

```
app/
  page.tsx               Single-page UI: input → form → assumptions → dashboard
  layout.tsx             Header + WindowName tag (for bookmarklet tab-reuse)
  actions/               Server Actions (Anthropic, Supabase, fetch URL)
  api/auth/callback/     Supabase OAuth callback

components/              UI (form, panels, dashboard, header, bookmarklet helper)
  Dashboard/             KPI cards, court fit, risk flags, summary, financial chart

lib/
  calculator.ts          Pure-TS — court fit, revenue, expenses, NOI, payback
  rating.ts              Pure — Strong / Worth / Risky / Do Not Pursue thresholds
  risk-flags.ts          Pure — six flag conditions (low ceiling, missing rent, etc.)
  summary-fallback.ts    Pure — deterministic summary template
  extract/               Anthropic client + Zod schema + regex fallback parser
  supabase/              Browser + server clients
  format.ts              fmtMoney, fmtPct, fmtYears
  constants.ts           DEFAULT_ASSUMPTIONS, EMPTY_LISTING

types/analysis.ts        ExtractedListing, Assumptions, AnalysisResult, RiskFlag, Rating

supabase/migrations/     SQL schema + RLS

docs/superpowers/
  specs/                 Design doc
  plans/                 Implementation plan
```

### Where logic lives

- **All math** in `lib/calculator.ts` — pure functions, no I/O, fully unit-tested
- **Anthropic** isolated to `lib/extract/anthropic.ts` + `app/actions/generate-summary.ts` — swappable
- **Supabase** isolated to `lib/supabase/*` + `app/actions/{save,list,delete}-property.ts`

Swapping any of the three (math, AI provider, DB) is a single-module change.

---

## Tech stack

- Next.js 16 (App Router) + TypeScript
- React 19
- Tailwind v4 + shadcn/ui (base-ui primitives)
- Vitest for the 38 pure-logic tests
- `@anthropic-ai/sdk`, `@supabase/ssr`, `zod`, `recharts`, `lucide-react`
- Jina Reader (`r.jina.ai`) for URL fetching

---

## Calculations (verbatim)

```
warehouseSqft        = listing.warehouseSqft ?? listing.totalSqft ?? 0
usableCourtArea      = warehouseSqft * 0.8
plannedBadminton     = floor(usableCourtArea * 0.6 / 1250)
plannedPickleball    = floor(usableCourtArea * 0.4 / 1800)

badmintonRevenue     = courts * 45 * 42 * 52
pickleballRevenue    = courts * 55 * 38 * 52
otherRevenue         = courtRevenue * 0.18
grossRevenue         = courtRevenue + otherRevenue

operatingExpenses    = annualRent + payroll + utilities + insurance +
                       maintenance + royalty + marketing + miscAdmin
noi                  = grossRevenue - operatingExpenses
rentBurden           = annualRent / grossRevenue
paybackYears         = noi > 0 ? (totalSqft * 28 + 40000) / noi : null
```

### Rating thresholds

```
totalSqft == 0 || rentPerSqftYr == null            → Incomplete
totalCourts < 4 || noi <= 0 || rentBurden > 0.35   → Do Not Pursue
payback ≤ 2.5 && margin ≥ 0.25 && rentBurden ≤ 22% → Strong Candidate
payback ≤ 4   && margin ≥ 0.15                     → Worth Investigating
                                                   → Risky
```

### Risk flags

- `low-clear-height` — ceiling < 24'
- `missing-rent` — no rent stated
- `too-few-courts` — < 6 total
- `high-rent-burden` — > 30%
- `office-space` — listing breaks out an office area
- `zoning` — surfaces zoning code for verification

---

## Costs

- **Vercel free tier** — covers this app comfortably
- **Anthropic** — Claude Haiku 4.5 at ~$0.004 per analysis (extraction + summary). $5 = ~1,250 analyses. Optional.
- **Supabase free tier** — 500MB DB, 50K MAU. More than enough. Optional.
- **Jina Reader free tier** — ~200 req/min. Optional.

---

## Out of scope (deferred)

- Multi-property comparison view
- PDF export
- Broker email generator
- Competitor / drive-time / demographic overlays
- Mobile-phone polish (works on tablet, not optimized for phones)

---

## Tests

```bash
npm test        # 38 pure-logic tests
npm run build   # production compile
```

The calculator, rating, risk-flags, summary-fallback, regex parser, and Zod schema all have unit-test coverage with the spec example as a fixture.

---

## Spec & plan

The full design doc and implementation plan are in [docs/superpowers/](docs/superpowers/). Both committed to git at the start of the project for reference.
