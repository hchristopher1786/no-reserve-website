# No Reserve Photography — Site Build Status

Last updated: 2026-06-18

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

- `public/` — static HTML (homepage, /wallpapers/, /gallery/)
- `src/index.js` — single Worker script, handles all of `/api/*`,
  falls through to static assets for everything else
- `wrangler.jsonc` — ties together assets directory, Worker entry point,
  and bindings (R2, KV)
- Deploys automatically via Cloudflare Workers Builds on push to `main`
  (GitHub integration, not manual upload)

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

## Deliberately stubbed — needs real implementation before any real launch

1. **Webhook signature verification** (`src/index.js`,
   `verifyStripeSignature()`) always returns `true`. This is a real
   security hole, not a TODO comment for show — without it, anyone who
   finds the webhook URL could fake a "payment succeeded" event.
2. **Price trust** — `priceCents` in `/api/checkout` comes straight from
   whatever the browser sends. Proven exploitable by literally calling
   `buyPhoto()` from the console with any price. Needs a server-side
   price list the Worker checks against instead of trusting client input.
3. **No download fulfillment** — webhook logs the photoId but doesn't
   yet look up the R2 object, generate a signed URL, or deliver it
   anywhere.
4. **No `/download-success` page** — currently a plain 404.
5. **No real photos** — wallpaper grid and client gallery pages are
   empty placeholders.
6. **KV namespace for client galleries** — was stripped from
   wrangler.jsonc early on (placeholder ID, no real namespace created
   yet). Needed before the client-gallery-by-token feature works at all.
7. **No design pass** — every page is bare HTML, no branding applied yet.

## Not yet decided

Which to build out first: the public wallpaper storefront, or the
private client gallery delivery flow (the more business-critical one,
since that's what auction clients actually need). Worth deciding before
diving into either.
