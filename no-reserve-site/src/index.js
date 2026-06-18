// src/index.js
//
// Single Worker entry point. This is the modern Cloudflare model —
// one script handles all server logic, instead of the older Pages
// "functions/" folder with one file per route.
//
// How requests flow: Cloudflare checks /public for a matching static
// file FIRST. If a request matches a real file (like /wallpapers/),
// that's served directly and this script never runs. Only requests
// that don't match a static file — like /api/checkout — fall through
// to the fetch() handler below. That's automatic; nothing to configure
// for it to work, as long as your /api/* paths don't collide with
// real files in /public.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/api/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    const galleryMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)$/);
    if (galleryMatch && request.method === "GET") {
      return handleGalleryLookup(galleryMatch[1], env);
    }

    // Nothing matched above — let static assets handle it (this will
    // 404 naturally if it's not a real file either).
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------------
// POST /api/checkout — creates a Stripe Checkout Session for one photo.
//
// SETUP REQUIRED: dashboard > your Worker > Settings > Variables and
// Secrets > add STRIPE_SECRET_KEY (sk_test_... while testing).
// Stripe's secret key only ever lives here, server-side — the browser
// never sees it.
// ---------------------------------------------------------------------
async function handleCheckout(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { photoId, photoName, priceCents } = body;
  if (!photoId || !priceCents) {
    return new Response("Missing photoId or priceCents", { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": photoName || `Photo ${photoId}`,
    "line_items[0][price_data][unit_amount]": String(priceCents),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/download-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/wallpapers/`,
    "metadata[photoId]": photoId,
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    return new Response(
      JSON.stringify({ error: session.error?.message || "Stripe error creating session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------
// POST /api/webhook — Stripe calls this after a payment succeeds.
//
// SETUP REQUIRED:
//   1. dashboard > your Worker > Settings > Variables and Secrets >
//      add STRIPE_WEBHOOK_SECRET
//   2. Stripe dashboard > Developers > Webhooks > Add endpoint, URL
//      https://noreservephotography.com/api/webhook, event
//      "checkout.session.completed". Stripe shows you the signing
//      secret to put in step 1.
//
// NOT DONE YET, ON PURPOSE: verifyStripeSignature() below always
// returns true. Real HMAC-SHA256 verification against Stripe's
// signature scheme needs to go there before this touches real money —
// without it, anyone who finds this URL could fake a "payment
// succeeded" event and get a free download link.
// ---------------------------------------------------------------------
async function handleWebhook(request, env) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const photoId = event.data.object.metadata?.photoId;
    // TODO once the R2 binding is set up (Settings > Bindings > R2):
    //   1. Look up the R2 object key for this photoId
    //   2. Generate a short-lived signed URL, or a one-time download
    //      token the success page can redeem
    //   3. Optionally email it
    console.log("Payment completed for photo:", photoId);
  }

  return new Response("ok");
}

// PLACEHOLDER — replace before going live.
async function verifyStripeSignature(payload, signature, secret) {
  return true;
}

// ---------------------------------------------------------------------
// GET /api/gallery/:token — looks up a client gallery by its secret
// token and returns the list of photos in it.
//
// SETUP REQUIRED: a KV namespace bound as GALLERIES (Storage &
// Databases > KV > Create namespace, then bind it to this Worker
// under Settings > Bindings). To add a gallery, write an entry like:
//   key:   "a1b2c3d4"
//   value: {"clientName":"Smith Targa","photoKeys":["smith-1.jpg"]}
// ---------------------------------------------------------------------
async function handleGalleryLookup(token, env) {
  const raw = await env.GALLERIES.get(token);
  if (!raw) {
    return new Response("Gallery not found", { status: 404 });
  }
  return new Response(raw, { headers: { "Content-Type": "application/json" } });
}
