// src/catalog.js
//
// Server-side source of truth for purchasable wallpapers. The browser
// only ever sends a photoId — the price, display name, and R2 object key
// are looked up HERE so the client can't tamper with the amount charged
// or smuggle in a different file. This is what closes the old
// "priceCents comes straight from the browser" hole.
//
// r2Key is the object key inside the PHOTOS_BUCKET R2 bucket. Upload the
// real full-resolution files to these keys, e.g.:
//   wrangler r2 object put no-reserve-photos/wallpapers/wallpaper-01.jpg --file=./wallpaper-01.jpg
//
// Keep the photoId values in sync with the onclick="buyPhoto(...)" calls
// in public/wallpapers/index.html.

export const WALLPAPERS = {
  "wallpaper-01": { name: "No Reserve Wallpaper 01", priceCents: 100, r2Key: "wallpapers/wallpaper-01.jpg" },
  "wallpaper-02": { name: "No Reserve Wallpaper 02", priceCents: 100, r2Key: "wallpapers/wallpaper-02.jpg" },
  "wallpaper-03": { name: "No Reserve Wallpaper 03", priceCents: 100, r2Key: "wallpapers/wallpaper-03.jpg" },
  "wallpaper-04": { name: "No Reserve Wallpaper 04", priceCents: 100, r2Key: "wallpapers/wallpaper-04.jpg" },
  "wallpaper-05": { name: "No Reserve Wallpaper 05", priceCents: 100, r2Key: "wallpapers/wallpaper-05.jpg" },
  "wallpaper-06": { name: "No Reserve Wallpaper 06", priceCents: 100, r2Key: "wallpapers/wallpaper-06.jpg" },
};

// Returns the catalog entry for a photoId, or null if it isn't a real
// product. Uses hasOwnProperty so prototype keys ("toString", etc.)
// can't be passed off as valid products.
export function getWallpaper(photoId) {
  return Object.prototype.hasOwnProperty.call(WALLPAPERS, photoId)
    ? WALLPAPERS[photoId]
    : null;
}
