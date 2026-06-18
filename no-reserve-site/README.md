# No Reserve Photography — site scaffold

Skeleton, not the finished site — minimal logic everywhere so the
plumbing can be confirmed before any real design or content goes in.

This uses Cloudflare's current model: one Worker script (`src/index.js`)
handles all server logic, and static files live in `public/`. (Older
guides describe a separate "Pages" product with a `functions/` folder —
Cloudflare has been folding that into this unified Workers approach,
which is why the dashboard now says "Create a Worker" even for a
mostly-static site like this one.)

## Structure

```
public/index.html              homepage
public/wallpapers/index.html   public, free-to-browse gallery + buy button
public/gallery/index.html      client gallery viewer (reads ?token=...)
src/index.js                   the one Worker script — routes /api/* requests,
                                falls through to static assets for everything else
wrangler.jsonc                 ties together the assets folder, the script, and bindings
package.json                   so the deploy step has wrangler available
```

## Step 0 — get this into a GitHub repo

1. Go to github.com/new (logged in as hchristopher1786).
2. Name it something like `no-reserve-website`. Public or private both
   work — Cloudflare just needs read access via the GitHub connection.
   Skip adding a README; an empty repo is easiest to upload into.
3. Create the repo. On its page, click "uploading an existing file."
4. Drag the whole unzipped `no-reserve-site` folder into the upload
   box (modern GitHub keeps the subfolder structure when you drag a
   folder, not just individual files). Commit to main.
5. Back in the Cloudflare wizard, search for the repo name and select
   it, then continue through "Create and deploy."

No command line needed for this part — git/Wrangler only come into
play later, if you want local development.

## What needs to happen in the Cloudflare dashboard

1. **Create the R2 bucket.** Storage & Databases > R2 Object Storage >
   Create bucket. Name it `no-reserve-photos` (or update the name in
   wrangler.jsonc to match).
2. **Create a KV namespace** for gallery tokens. Storage & Databases >
   KV > Create namespace. Copy its ID into wrangler.jsonc where it
   says REPLACE_WITH_YOUR_KV_NAMESPACE_ID.
3. **Bind both to the Worker**, if they aren't picked up automatically
   from wrangler.jsonc: Settings > Bindings > Add.
4. **Add environment variables**: Settings > Variables and Secrets >
   STRIPE_SECRET_KEY, and later STRIPE_WEBHOOK_SECRET.
5. **Set up the Stripe webhook**: Stripe dashboard > Developers >
   Webhooks > Add endpoint > `https://noreservephotography.com/api/webhook`,
   listening for `checkout.session.completed`.

## What's still a stub, on purpose

- Webhook signature verification in `src/index.js` is flagged clearly
  and needs real implementation before any payment goes through it.
- Nothing renders actual photos yet.
- No design pass has happened.
