# No Reserve Photography — Site Build Status

Last updated: 2026-06-19

## What this is

Self-built replacement for Pixieset. Architecture: Cloudflare Worker with
static assets (NOT the older "Pages" product — Cloudflare folded Pages
into a unified Workers model in 2026, so if any guidance mentions a
`functions/` folder or Pages Functions, that's outdated for this repo).

Repo: github.com/hchristopher1786/no-reserve-website (root level — files
were originally nested one level deep after a GitHub upload, then moved
up to repo root).
Live: no-reserve-photography.harrycchristopher.workers.dev

## Architecture

- `public/` — static HTML pages, all sharing one design system:
  - `/` homepage, `/wallpapers/` storefront, `/client-galleries/`
    token gallery, `/download-success/` post-purchase page
  - `assets/css/main.css` (shared dark-charcoal design system),
    `assets/js/main.js` (shared nav toggle); page-specific JS is inline
  - logo PNGs live at the repo root of `public/`, underscore-named
    (`Logo_Rectangular_Transp_Back.png`, `Logo_Circular_PNG.png`, …)
- `src/index.js` — single Worker script, handles all of `/api/*`,
  falls through to static assets for everything else
- `src/catalog.js` — server-side wallpaper catalog (photoId →
  name/priceCents/r2Key). Source of truth for price + R2 mapping.
- `wrangler.jsonc` — ties together assets directory, Worker entry point,
  and bindings (R2 bound; KV not yet — see below)
- Deploys automatically via Cloudflare Workers Builds on push to `main`
  (GitHub integration, not manual upload)

## API routes (`src/index.js`)

- `POST /api/checkout` — creates a Stripe Checkout Session. Price + name
  now looked up server-side from `catalog.js` by photoId (browser input
  for price is ignored).
- `POST /api/webhook` — Stripe `checkout.session.completed`. Signature
  verified for real; fails closed if the secret is missing.
- `GET /api/download?session_id=...` — verifies the session is paid via
  Stripe, then streams the purchased wallpaper from R2 as an attachment.
- `GET /api/gallery/{token}` — returns a client gallery's JSON from KV.
- `GET /api/photo/{token}/{photoKey}` — token-gated; verifies the key
  belongs to that gallery, then streams the photo from R2.

## Confirmed working (tested 2026-06-18)

- Static site loads, routing works
- `/api/checkout` creates a real Stripe Checkout Session
- Stripe webhook destination registered, pointed at `/api/webhook`,
  listening for `checkout.session.completed`
- Full loop verified in Observability → Invocations: checkout → Stripe
  webhook call → redirect to success page, all three steps fired in
  sequence for a test purchase
- R2 bucket `no-reserve-photos` created and bound as `PHOTOS_BUCKET`
- Stripe is in **test mode** (sk_test_/whsec_ keys in Cloudflare env vars)

## Resolved since 2026-06-18

- **Design pass done.** All pages rebuilt on a shared dark-charcoal
  design system (Inter body / Oswald condensed headings, sharp edges,
  fixed nav with mobile hamburger, brightness hover). Old bare-HTML
  pages replaced. Old `/gallery/` page removed; replaced by
  `/client-galleries/`.
- **Webhook signature verification** — real HMAC-SHA256 against Stripe's
  scheme with replay protection; fails closed if the secret is unset.
- **Price trust** — fixed. `/api/checkout` reads price/name from
  `src/catalog.js`, never from the request body.
- **Download fulfillment** — `/api/download` verifies the Stripe session
  is paid, then streams the file from R2. `/download-success` shows a
  Download button wired to it.

## Still needed before a real launch

1. **Bind the GALLERIES KV namespace.** Not bound yet (a placeholder ID
   broke deploys earlier, so it's deliberately absent). `/api/gallery`
   and `/api/photo` return 503 until it's set up:
       wrangler kv namespace create GALLERIES
   then add to wrangler.jsonc:
       "kv_namespaces": [{ "binding": "GALLERIES", "id": "<real id>" }]
   The wallpaper download flow does NOT depend on this.
2. **Upload real photos to R2.** Wallpapers must land at the keys in
   `catalog.js` (`wallpapers/wallpaper-01.jpg` …). Gallery photos must
   match each gallery's `photoKeys`. Until then `/api/download` and
   `/api/photo` return 404 ("file not available yet").
3. **Create client gallery entries in KV** (after step 1):
       key: "<token>"  value: {"clientName":"...","photoKeys":["..."]}
4. **Drop in real placeholder swaps** — hero photo, carousel images,
   about image, wallpaper card images, wallpaper titles/prices.
5. **Switch Stripe to live mode** and confirm the webhook secret +
   keys are the live ones before taking real money.
6. **Footer links** — Instagram and Bring a Trailer hrefs are still `#`.
7. **Custom domain** — wire noreservephotography.com to the Worker.
