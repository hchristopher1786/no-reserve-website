# No Reserve Photography

Website for **No Reserve Photography, LLC** — auction-car photography in
Houston, TX. Live at https://noreservephotography.com.

A mostly-static site fronted by a single Cloudflare Worker. This uses
Cloudflare's current model: one Worker script (`src/index.js`) handles all
server logic, and static files live in `public/`. (Older guides describe a
separate "Pages" product with a `functions/` folder — Cloudflare folded that
into the unified Workers approach, which is why the dashboard says "Create a
Worker" even for a mostly-static site like this.)

> Working in this repo with Claude? See **CLAUDE.md** for architecture,
> conventions, and gotchas.

## Structure

```
public/index.html                  homepage (hero + carousel)
public/wallpapers/index.html       paid wallpaper storefront (Stripe)
public/bat-portfolio/index.html    auction portfolio (data-driven from listings.json)
public/client-galleries/index.html token-gated client gallery viewer
public/download-success/index.html post-purchase download page
public/assets/css/main.css         shared design system (dark charcoal)
public/assets/js/main.js           shared nav behavior
src/index.js                       the one Worker script — routes /api/*, else static
src/catalog.js                     server-side wallpaper catalog (price + R2 key)
src/zip.js                         local STORE-zip writer for gallery archives
wrangler.jsonc                     assets dir, Worker entry, and bindings
```

## How it works

- **Static-first routing.** Requests are matched against `public/` before the
  Worker runs; only unmatched paths (the `/api/*` routes) reach `src/index.js`.
- **Stripe wallpaper sales.** `/api/checkout` creates a Checkout Session with
  price/name looked up server-side from `src/catalog.js` (never trusted from
  the browser). `/api/webhook` verifies Stripe's signature (HMAC-SHA256 +
  replay protection, fails closed). `/api/download` confirms the session is
  paid, then streams the original from R2.
- **Client galleries.** Token-gated: `/api/gallery/{token}` returns a
  gallery's photo list from KV; `/api/photo`, `/api/gallery-download`, and
  `/api/gallery-zip` serve previews, full-res originals, and a prebuilt ZIP
  from R2, all verified against the gallery token.
- **Homepage carousel.** `/api/carousel` (config from KV) and
  `/api/carousel-photo/{key}` (image from R2), both public.
- **Auction portfolio.** Fully static — `public/bat-portfolio/index.html`
  reads `listings.json` and serves thumbnails from
  `public/bat-portfolio/Images/`. No Worker route involved. See CLAUDE.md for
  the add-a-listing workflow.

## Bindings (wrangler.jsonc)

- `PHOTOS_BUCKET` — R2 bucket `no-reserve-photos`
- `GALLERIES` — KV namespace for client-gallery tokens
- `CAROUSEL` — KV namespace for the homepage carousel config
- `ASSETS` — the `public/` static-assets binding

## Deploy

Push to `main` and Cloudflare auto-deploys from the GitHub connection (expect
~1 minute of lag). `npm run deploy` (`wrangler deploy`) is the manual
alternative.

## Required configuration (Cloudflare dashboard)

- **R2 bucket** `no-reserve-photos` (Storage & Databases > R2), bound as
  `PHOTOS_BUCKET`.
- **KV namespaces** `GALLERIES` and `CAROUSEL`, bound per `wrangler.jsonc`.
- **Secrets** (Settings > Variables and Secrets): `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`.
- **Stripe webhook** (Stripe > Developers > Webhooks): endpoint
  `https://noreservephotography.com/api/webhook`, event
  `checkout.session.completed`.

## Before taking real payments

- Switch Stripe from test mode to live keys (and the live webhook secret).
