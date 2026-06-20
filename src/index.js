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

import { getWallpaper } from "./catalog.js";
import { crc32, buildLocalHeader, buildCentralHeader, buildEnd } from "./zip.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/api/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    // Paid wallpaper download. The session_id Stripe puts on the
    // success_url is the proof of purchase — we verify it server-side.
    if (url.pathname === "/api/download" && request.method === "GET") {
      return handleDownload(request, env);
    }

    const galleryMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)$/);
    if (galleryMatch && request.method === "GET") {
      return handleGalleryLookup(galleryMatch[1], env);
    }

    // Private client-gallery image: /api/photo/{token}/{photoKey}.
    // The trailing (.+) lets photoKeys contain slashes. We verify the key
    // belongs to that gallery token before streaming anything from R2.
    const photoMatch = url.pathname.match(/^\/api\/photo\/([^/]+)\/(.+)$/);
    if (photoMatch && request.method === "GET") {
      return handlePhoto(
        decodeURIComponent(photoMatch[1]),
        decodeURIComponent(photoMatch[2]),
        env
      );
    }

    // Full-resolution client-gallery download: /api/gallery-download/{token}/{key}.
    // Same token-gating as /api/photo, but checks the gallery's downloadKeys
    // (the full-res originals) and serves them as a file attachment.
    const galDownloadMatch = url.pathname.match(/^\/api\/gallery-download\/([^/]+)\/(.+)$/);
    if (galDownloadMatch && request.method === "GET") {
      return handleGalleryDownload(
        decodeURIComponent(galDownloadMatch[1]),
        decodeURIComponent(galDownloadMatch[2]),
        env
      );
    }

    // Whole-gallery ZIP: /api/gallery-zip/{token}. Streams every full-res
    // original (downloadKeys) as a single STORE archive, built on the fly.
    const galZipMatch = url.pathname.match(/^\/api\/gallery-zip\/([^/]+)$/);
    if (galZipMatch && request.method === "GET") {
      return handleGalleryZip(decodeURIComponent(galZipMatch[1]), env);
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

  const { photoId } = body;
  if (!photoId) {
    return new Response("Missing photoId", { status: 400 });
  }

  // Price and name come from the server-side catalog, NEVER from the
  // request body. The browser only gets to pick *which* product.
  const item = getWallpaper(photoId);
  if (!item) {
    return new Response("Unknown photoId", { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": item.name,
    "line_items[0][price_data][unit_amount]": String(item.priceCents),
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
// Signature verification is implemented in verifyStripeSignature()
// below (real HMAC-SHA256 against Stripe's scheme, with replay
// protection). The handler fails closed if STRIPE_WEBHOOK_SECRET is
// missing or the signature doesn't match.
// ---------------------------------------------------------------------
async function handleWebhook(request, env) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    // Fail closed: without the secret we can't verify anything, so we
    // must not process the event. Misconfiguration should never silently
    // fall back to "trust everyone".
    console.error("STRIPE_WEBHOOK_SECRET is not set; rejecting webhook.");
    return new Response("Webhook not configured", { status: 500 });
  }

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

// Verifies Stripe's webhook signature using the same scheme the official
// Stripe SDKs use, implemented against the Workers Web Crypto API.
//
// The "stripe-signature" header looks like:
//   t=1690000000,v1=5257a8...,v1=...
// We rebuild the signed payload as `${t}.${rawBody}`, HMAC-SHA256 it with
// the endpoint signing secret (the full "whsec_..." string is the key),
// and check that the hex digest matches one of the v1 signatures using a
// constant-time compare. We also reject timestamps outside a tolerance
// window so a captured request can't be replayed later.
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60; // matches Stripe's default

async function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) return false;

  // Parse "t=...,v1=...,v1=..." into a timestamp and the list of v1 sigs.
  let timestamp;
  const expectedSigs = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1" && value) {
      expectedSigs.push(value);
    }
  }

  if (!timestamp || expectedSigs.length === 0) return false;

  // Reject stale/future timestamps to prevent replay attacks.
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  // Compute HMAC-SHA256 over `${t}.${payload}`.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedPayload = encoder.encode(`${timestamp}.${payload}`);
  const digest = await crypto.subtle.sign("HMAC", key, signedPayload);
  const expectedHex = bufferToHex(digest);

  // A signature is valid if it matches any of the provided v1 values.
  // Compare every candidate (no early return) to keep timing constant.
  let matched = false;
  for (const candidate of expectedSigs) {
    if (timingSafeEqual(candidate, expectedHex)) {
      matched = true;
    }
  }
  return matched;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

// Constant-time string comparison to avoid leaking signature bytes via
// response timing. Returns false immediately on length mismatch (the
// length of a hex SHA-256 digest is not secret).
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
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
  // The GALLERIES KV namespace isn't bound until a real namespace is
  // created and added to wrangler.jsonc. Fail clearly instead of throwing.
  if (!env.GALLERIES) {
    return new Response("Galleries not configured", { status: 503 });
  }
  const raw = await env.GALLERIES.get(token);
  if (!raw) {
    return new Response("Gallery not found", { status: 404 });
  }
  return new Response(raw, { headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------
// GET /api/download?session_id=... — delivers a paid wallpaper.
//
// The success_url Stripe redirects to carries the Checkout Session id.
// We retrieve that session straight from Stripe and only serve the file
// if payment_status === "paid". This is more reliable than waiting on the
// webhook (which can lag), and the session id can't be forged — an
// attacker would have to actually pay.
// ---------------------------------------------------------------------
async function handleDownload(request, env) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return new Response("Missing session_id", { status: 400 });
  }
  if (!env.STRIPE_SECRET_KEY) {
    return new Response("Checkout not configured", { status: 500 });
  }

  // Verify the purchase with Stripe.
  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!stripeRes.ok) {
    return new Response("Could not verify purchase", { status: 404 });
  }
  const session = await stripeRes.json();
  if (session.payment_status !== "paid") {
    return new Response("Payment not completed", { status: 402 });
  }

  // Map the purchased photoId back to its R2 object via the catalog.
  const photoId = session.metadata?.photoId;
  const item = photoId ? getWallpaper(photoId) : null;
  if (!item) {
    return new Response("Purchased item not found", { status: 404 });
  }

  const object = await env.PHOTOS_BUCKET.get(item.r2Key);
  if (!object) {
    // Paid for, but the file hasn't been uploaded to R2 yet.
    return new Response("File not available yet", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers); // content-type etc. stored on the object
  if (!headers.get("content-type")) {
    headers.set("content-type", contentTypeFor(item.r2Key));
  }
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");
  // Force a download with a sensible filename rather than rendering inline.
  const filename = item.r2Key.split("/").pop();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new Response(object.body, { headers });
}

// ---------------------------------------------------------------------
// GET /api/photo/{token}/{photoKey} — streams one private gallery photo.
//
// Token-gated: we look up the gallery by its secret token and only serve
// the object if photoKey is actually one of that gallery's photoKeys.
// That stops someone from pulling arbitrary objects out of the bucket by
// guessing keys.
// ---------------------------------------------------------------------
async function handlePhoto(token, photoKey, env) {
  if (!env.GALLERIES) {
    return new Response("Galleries not configured", { status: 503 });
  }

  const raw = await env.GALLERIES.get(token);
  if (!raw) {
    return new Response("Not found", { status: 404 });
  }

  let gallery;
  try {
    gallery = JSON.parse(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const keys = Array.isArray(gallery.photoKeys) ? gallery.photoKeys : [];
  if (!keys.includes(photoKey)) {
    // Key isn't part of this gallery — same 404 as a missing gallery so
    // we don't confirm which keys exist.
    return new Response("Not found", { status: 404 });
  }

  const object = await env.PHOTOS_BUCKET.get(photoKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("content-type")) {
    headers.set("content-type", contentTypeFor(photoKey));
  }
  headers.set("etag", object.httpEtag);
  // Private: it's a client's gallery. Allow brief reuse within the browser.
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
}

// ---------------------------------------------------------------------
// GET /api/gallery-download/{token}/{key} — full-resolution download.
//
// Same token-gating as /api/photo, but validates against the gallery's
// downloadKeys (the full-res originals) and serves the object as a file
// attachment so the browser saves it instead of rendering it inline.
// ---------------------------------------------------------------------
async function handleGalleryDownload(token, key, env) {
  if (!env.GALLERIES) {
    return new Response("Galleries not configured", { status: 503 });
  }

  const raw = await env.GALLERIES.get(token);
  if (!raw) {
    return new Response("Not found", { status: 404 });
  }

  let gallery;
  try {
    gallery = JSON.parse(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const keys = Array.isArray(gallery.downloadKeys) ? gallery.downloadKeys : [];
  if (!keys.includes(key)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.PHOTOS_BUCKET.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("content-type")) {
    headers.set("content-type", contentTypeFor(key));
  }
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");
  const filename = key.split("/").pop();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new Response(object.body, { headers });
}

// ---------------------------------------------------------------------
// GET /api/gallery-zip/{token} — streams every full-res original in the
// gallery as one STORE (uncompressed) ZIP, built on the fly.
//
// Memory stays bounded to ~one file: we buffer each object, compute its
// CRC, write its local header + bytes, then move on. Backpressure from
// the response stream throttles us to the client's download speed.
// ---------------------------------------------------------------------
async function handleGalleryZip(token, env) {
  if (!env.GALLERIES) {
    return new Response("Galleries not configured", { status: 503 });
  }

  const raw = await env.GALLERIES.get(token);
  if (!raw) {
    return new Response("Not found", { status: 404 });
  }

  let gallery;
  try {
    gallery = JSON.parse(raw);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const keys = Array.isArray(gallery.downloadKeys) ? gallery.downloadKeys : [];
  if (keys.length === 0) {
    return new Response("Nothing to download", { status: 404 });
  }

  const enc = new TextEncoder();
  const slug = slugify(gallery.clientName || token);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      const central = [];
      let offset = 0;
      for (const key of keys) {
        const object = await env.PHOTOS_BUCKET.get(key);
        if (!object) continue; // skip anything missing rather than abort
        const data = new Uint8Array(await object.arrayBuffer());
        const crc = crc32(data);
        const date = object.uploaded ? new Date(object.uploaded) : new Date();
        // Entry name: put everything under a folder named for the client.
        const nameBytes = enc.encode(`${slug}/${key.split("/").pop()}`);

        const lh = buildLocalHeader({ nameBytes, crc, size: data.length, date });
        await writer.write(lh);
        await writer.write(data);
        central.push({ nameBytes, crc, size: data.length, offset, date });
        offset += lh.length + data.length;
      }

      let cdSize = 0;
      for (const e of central) {
        const ch = buildCentralHeader(e);
        await writer.write(ch);
        cdSize += ch.length;
      }
      await writer.write(buildEnd({ count: central.length, cdSize, cdOffset: offset }));
      await writer.close();
    } catch (err) {
      // The response stream may have already started; aborting signals the
      // client the archive is incomplete rather than leaving a valid-looking
      // truncated file.
      await writer.abort(err);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Lowercase, hyphenated slug for filenames (e.g. "2013 Viper GTS" ->
// "2013-viper-gts"). Falls back to "gallery" if nothing usable remains.
function slugify(s) {
  const out = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "gallery";
}

// Minimal extension -> MIME fallback for objects stored in R2 without
// content-type metadata. Browsers sniff images anyway, but a correct
// header avoids surprises.
function contentTypeFor(key) {
  const ext = key.split(".").pop().toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    tiff: "image/tiff",
  };
  return map[ext] || "application/octet-stream";
}
