# CLAUDE.md

Guidance for working in this repo. Keep it current as the project evolves.

## What this is

The website for **No Reserve Photography, LLC** — auction-car photography
(Houston, TX). It's a mostly-static site fronted by a single Cloudflare
Worker. Domain: https://noreservephotography.com.

## Architecture

- **`src/index.js`** — the one Worker script. Its `fetch()` handler matches
  `/api/*` routes; anything that doesn't match falls through to
  `env.ASSETS.fetch(request)`, which serves static files from `public/`.
  Cloudflare checks `public/` for a real file FIRST, so a static file always
  wins over the Worker for the same path. Keep `/api/*` paths from colliding
  with real files in `public/`.
- **`src/catalog.js`** — server-side source of truth for purchasable
  wallpapers (photoId → price + R2 key). Prices are looked up here, never
  trusted from the client.
- **`src/zip.js`** — helper used for the gallery ZIP route.
- **`public/`** — all pages and static assets. Each page is a standalone
  `index.html` (no build system / no framework).
- **`wrangler.jsonc`** — bindings config.

### Bindings (in wrangler.jsonc)
- `PHOTOS_BUCKET` — R2 bucket `no-reserve-photos` (originals, wallpapers,
  carousel images, client-gallery photos, prebuilt gallery ZIPs).
- `GALLERIES` — KV namespace for client-gallery tokens.
- `CAROUSEL` — KV namespace for the homepage carousel config.
- `ASSETS` — the `public/` static-assets binding.

### Key routes in src/index.js
- `POST /api/checkout`, `POST /api/webhook`, `GET /api/download` — Stripe
  wallpaper purchase flow. Webhook signature verification is implemented
  (HMAC-SHA256 + replay protection); fails closed if the secret is missing.
- `GET /api/gallery/:token`, `/api/photo/:token/:key`,
  `/api/gallery-download/:token/:key`, `/api/gallery-zip/:token` —
  token-gated client galleries.
- `GET /api/carousel`, `/api/carousel-photo/:key` — public homepage carousel.
- `GET /api/portfolio-photo/:key` — **now unused.** Portfolio thumbnails moved
  to static files (see below). Route + its R2 objects are dead code pending
  cleanup.

## Deploy

- **Push to `main` → Cloudflare auto-deploys** from the GitHub connection.
  Expect ~1 minute of lag before changes go live; don't assume a failure if
  the site looks unchanged immediately.
- `npm run deploy` (`wrangler deploy`) is the manual alternative.
- Only commit/push when the user asks. Commit messages end with the
  `Co-Authored-By: Claude Opus 4.8` trailer.

## Conventions & gotchas

- **Shared header is duplicated per page** (no build system). The
  `<header class="site-header">…</header>` block lives in every page's HTML.
  When nav changes, update it in ALL pages: `public/index.html`,
  `public/wallpapers/index.html`, `public/bat-portfolio/index.html`,
  `public/client-galleries/index.html`. Set `class="is-active"` on the
  current page's link. (`.site-header` is the correct markup styled by
  `main.css` — older `.nav`/`.nav-links` markup renders unstyled.)
- **Static assets are case-sensitive** on Cloudflare. Filenames and the paths
  that reference them must match exactly. Convention: lowercase-hyphenated
  (e.g. `2014-landrover-lr4.jpg`).
- **Don't edit `main.css` / `main.js`** unless asked — pages share them.
- **R2 uploads target production:** `wrangler r2 object put
  no-reserve-photos/<key> --file <path> --content-type <type> --remote`.
  The `--remote` flag hits the live bucket the site reads from.
- On Windows, git prints `LF will be replaced by CRLF` warnings — harmless.
- `.wrangler/` is local build cache — leave it untracked.

## Auction portfolio page (`public/bat-portfolio/`)

Data-driven and fully static. `index.html` fetches `listings.json`, sorts
newest-first by `year`, and derives each tile's platform badge from
`listingUrl`'s host (Bring a Trailer, Cars & Bids, PCarMarket, Mecum,
eBay Motors). Thumbnails are static files in
`public/bat-portfolio/Images/`, referenced by a `thumb` path per listing.

**To add a listing (never edit the HTML):**
1. Resize the photo to ~1600px wide (keeps the grid fast, repo lean).
2. Save it lowercase-hyphenated into `public/bat-portfolio/Images/`.
3. Add a block to `listings.json`: `year`, `make`, `model`, `listingUrl`,
   and `thumb: "/bat-portfolio/Images/<file>.jpg"`.
4. Commit and push.
