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
- **49 wallpapers live.** Imported from a Google Takeout export, renamed
  `wallpaper-01..51` (two duplicate originals dropped, gaps at 22 & 35),
  uploaded to R2 at `wallpapers/wallpaper-NN.jpg`, listed in `catalog.js`,
  rendered on the dynamic storefront with downscaled public preview
  thumbnails in `public/assets/wallpapers/`. Originals kept out of the
  repo in `C:\staging\wallpapers\` so full-res stays paywalled.
- **GALLERIES KV bound.** Namespace created (id
  `8d54027017b04c1e81d851f7992e266c`) and added to `wrangler.jsonc`;
  `/api/gallery` and `/api/photo` verified live. (The earlier `demo`
  entry was deleted.)
  NOTE: write KV JSON values WITHOUT a BOM (PowerShell `Set-Content
  -Encoding UTF8` adds one and breaks `JSON.parse`); use a BOM-free file.
- **Client galleries — full workflow proven.** First real gallery is the
  "2013 Viper GTS" (access code `viper-b8p2b7wd`, 81 photos). Pattern:
  generate ~2048px web previews + keep full-res, upload both to R2 under
  `galleries/<slug>/viper-NN.jpg` (preview) and
  `galleries/<slug>/originals/viper-NN.jpg` (full-res), then a KV entry
  with `photoKeys` (previews) and `downloadKeys` (full-res), index-aligned.
  HEIC inputs are converted to JPEG via WIC (System.Drawing can't decode
  HEIC). Staging originals live in `C:\staging\galleries\<slug>\`.
- **Client-gallery full-res download.** `/api/gallery-download/{token}/{key}`
  token-gates against `downloadKeys` and serves the original as an
  attachment. The gallery page shows previews with a per-photo "↓ Full-res"
  link.
- **Whole-gallery ZIP — PRE-GENERATED, stored in R2.** Building the archive
  on the fly in the Worker is NOT viable: every byte passes through JS and
  trips the Workers CPU limit (`exceededCpu`, confirmed via `wrangler tail` —
  happens even with zero CRC, just piping bytes). So we build `all.zip` once,
  offline, and store it in R2; `/api/gallery-zip/{token}` just streams that
  stored object natively (`Response(object.body)` — no per-byte JS) with
  HTTP Range support so interrupted downloads resume. KV gains `zipKey`.
  WORKFLOW to (re)build a gallery's archive:
    1. `src/zip.js` is a local STORE-zip writer. Build `all.zip` from the
       full-res originals (entries named `<slug>/viper-NN.jpg`), STORE mode.
    2. Upload to R2 at `galleries/<slug>/all.zip`. NOTE: both `wrangler r2
       object put` (~315 MiB) and the R2 dashboard (300 MB) cap single
       uploads, so a ~1GB archive needs MULTIPART. Use **rclone** (installed
       via `winget install Rclone.Rclone`); it auto-multiparts with no size
       cap. The configured rclone remote is named **`S3`** (misnomer — it
       points at THIS R2 bucket over the S3-compatible API; the name is just
       a label, not a different provider/account).
         One-time setup: create an R2 S3 API token (dashboard → R2 → Manage
         R2 API Tokens → Object Read & Write, scoped to `no-reserve-photos`),
         then `rclone config` a remote named `S3`, type `s3`, provider
         Cloudflare, with that token and endpoint
         `https://<account-id>.r2.cloudflarestorage.com`, region `auto`.
         Upload command:
           rclone copyto "C:\staging\galleries\<slug>\all.zip" \
             S3:no-reserve-photos/galleries/<slug>/all.zip --s3-no-check-bucket
       (The earlier temporary `/api/_mpu` Worker endpoint is removed and no
       longer needed now that rclone handles large uploads.)
    3. Set `zipKey` in the gallery's KV entry.
  DONE for the Viper gallery: `all.zip` (964,474,792 bytes, 81 files) is
  uploaded to `galleries/2013-viper-gts/all.zip` and verified live end to
  end (full `unzip -t` clean, Range/resume works). "Download all (ZIP)" at
  `/client-galleries/` (code `viper-b8p2b7wd`) works.
  (`crcs`/`sizes` remain in the KV entry from the abandoned on-the-fly
  approach; harmless, unused now.)

## Still needed before a real launch

1. **Add more client galleries as needed** using the proven workflow
   above (previews + originals to R2, KV entry with photoKeys +
   downloadKeys, BOM-free). One real gallery (Viper GTS) exists so far.
2. **Drop in real placeholder swaps** — hero photo, carousel images,
   about image. (Wallpaper card thumbnails are done.)
3. **Switch Stripe to live mode** and confirm the webhook secret +
   keys are the live ones before taking real money.
4. **Footer links** — Instagram and Bring a Trailer hrefs are still `#`.
5. **Custom domain** — wire noreservephotography.com to the Worker.
