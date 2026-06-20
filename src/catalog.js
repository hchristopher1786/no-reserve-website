// src/catalog.js
//
// Server-side source of truth for purchasable wallpapers. The browser only
// ever sends a photoId; price, display name, and the R2 object key are looked
// up HERE so the client can't tamper with the amount charged or the file it
// receives. Originals live in R2 (no-reserve-photos/wallpapers/) only — never
// in public/, so they stay behind the $1 paywall.
//
// Generated from the Google Takeout export (51 photos). Display names are
// sequential placeholders — rename individual name fields anytime.

export const catalog = [
  { photoId: "wallpaper-01", name: "Wallpaper 01", priceCents: 100, r2Key: "wallpapers/wallpaper-01.jpg" },
  { photoId: "wallpaper-02", name: "Wallpaper 02", priceCents: 100, r2Key: "wallpapers/wallpaper-02.jpg" },
  { photoId: "wallpaper-03", name: "Wallpaper 03", priceCents: 100, r2Key: "wallpapers/wallpaper-03.jpg" },
  { photoId: "wallpaper-04", name: "Wallpaper 04", priceCents: 100, r2Key: "wallpapers/wallpaper-04.jpg" },
  { photoId: "wallpaper-05", name: "Wallpaper 05", priceCents: 100, r2Key: "wallpapers/wallpaper-05.jpg" },
  { photoId: "wallpaper-06", name: "Wallpaper 06", priceCents: 100, r2Key: "wallpapers/wallpaper-06.jpg" },
  { photoId: "wallpaper-07", name: "Wallpaper 07", priceCents: 100, r2Key: "wallpapers/wallpaper-07.jpg" },
  { photoId: "wallpaper-08", name: "Wallpaper 08", priceCents: 100, r2Key: "wallpapers/wallpaper-08.jpg" },
  { photoId: "wallpaper-09", name: "Wallpaper 09", priceCents: 100, r2Key: "wallpapers/wallpaper-09.jpg" },
  { photoId: "wallpaper-10", name: "Wallpaper 10", priceCents: 100, r2Key: "wallpapers/wallpaper-10.jpg" },
  { photoId: "wallpaper-11", name: "Wallpaper 11", priceCents: 100, r2Key: "wallpapers/wallpaper-11.jpg" },
  { photoId: "wallpaper-12", name: "Wallpaper 12", priceCents: 100, r2Key: "wallpapers/wallpaper-12.jpg" },
  { photoId: "wallpaper-13", name: "Wallpaper 13", priceCents: 100, r2Key: "wallpapers/wallpaper-13.jpg" },
  { photoId: "wallpaper-14", name: "Wallpaper 14", priceCents: 100, r2Key: "wallpapers/wallpaper-14.jpg" },
  { photoId: "wallpaper-15", name: "Wallpaper 15", priceCents: 100, r2Key: "wallpapers/wallpaper-15.jpg" },
  { photoId: "wallpaper-16", name: "Wallpaper 16", priceCents: 100, r2Key: "wallpapers/wallpaper-16.jpg" },
  { photoId: "wallpaper-17", name: "Wallpaper 17", priceCents: 100, r2Key: "wallpapers/wallpaper-17.jpg" },
  { photoId: "wallpaper-18", name: "Wallpaper 18", priceCents: 100, r2Key: "wallpapers/wallpaper-18.jpg" },
  { photoId: "wallpaper-19", name: "Wallpaper 19", priceCents: 100, r2Key: "wallpapers/wallpaper-19.jpg" },
  { photoId: "wallpaper-20", name: "Wallpaper 20", priceCents: 100, r2Key: "wallpapers/wallpaper-20.jpg" },
  { photoId: "wallpaper-21", name: "Wallpaper 21", priceCents: 100, r2Key: "wallpapers/wallpaper-21.jpg" },
  { photoId: "wallpaper-22", name: "Wallpaper 22", priceCents: 100, r2Key: "wallpapers/wallpaper-22.jpg" },
  { photoId: "wallpaper-23", name: "Wallpaper 23", priceCents: 100, r2Key: "wallpapers/wallpaper-23.jpg" },
  { photoId: "wallpaper-24", name: "Wallpaper 24", priceCents: 100, r2Key: "wallpapers/wallpaper-24.jpg" },
  { photoId: "wallpaper-25", name: "Wallpaper 25", priceCents: 100, r2Key: "wallpapers/wallpaper-25.jpg" },
  { photoId: "wallpaper-26", name: "Wallpaper 26", priceCents: 100, r2Key: "wallpapers/wallpaper-26.jpg" },
  { photoId: "wallpaper-27", name: "Wallpaper 27", priceCents: 100, r2Key: "wallpapers/wallpaper-27.jpg" },
  { photoId: "wallpaper-28", name: "Wallpaper 28", priceCents: 100, r2Key: "wallpapers/wallpaper-28.jpg" },
  { photoId: "wallpaper-29", name: "Wallpaper 29", priceCents: 100, r2Key: "wallpapers/wallpaper-29.jpg" },
  { photoId: "wallpaper-30", name: "Wallpaper 30", priceCents: 100, r2Key: "wallpapers/wallpaper-30.jpg" },
  { photoId: "wallpaper-31", name: "Wallpaper 31", priceCents: 100, r2Key: "wallpapers/wallpaper-31.jpg" },
  { photoId: "wallpaper-32", name: "Wallpaper 32", priceCents: 100, r2Key: "wallpapers/wallpaper-32.jpg" },
  { photoId: "wallpaper-33", name: "Wallpaper 33", priceCents: 100, r2Key: "wallpapers/wallpaper-33.jpg" },
  { photoId: "wallpaper-34", name: "Wallpaper 34", priceCents: 100, r2Key: "wallpapers/wallpaper-34.jpg" },
  { photoId: "wallpaper-35", name: "Wallpaper 35", priceCents: 100, r2Key: "wallpapers/wallpaper-35.jpg" },
  { photoId: "wallpaper-36", name: "Wallpaper 36", priceCents: 100, r2Key: "wallpapers/wallpaper-36.jpg" },
  { photoId: "wallpaper-37", name: "Wallpaper 37", priceCents: 100, r2Key: "wallpapers/wallpaper-37.jpg" },
  { photoId: "wallpaper-38", name: "Wallpaper 38", priceCents: 100, r2Key: "wallpapers/wallpaper-38.jpg" },
  { photoId: "wallpaper-39", name: "Wallpaper 39", priceCents: 100, r2Key: "wallpapers/wallpaper-39.jpg" },
  { photoId: "wallpaper-40", name: "Wallpaper 40", priceCents: 100, r2Key: "wallpapers/wallpaper-40.jpg" },
  { photoId: "wallpaper-41", name: "Wallpaper 41", priceCents: 100, r2Key: "wallpapers/wallpaper-41.jpg" },
  { photoId: "wallpaper-42", name: "Wallpaper 42", priceCents: 100, r2Key: "wallpapers/wallpaper-42.jpg" },
  { photoId: "wallpaper-43", name: "Wallpaper 43", priceCents: 100, r2Key: "wallpapers/wallpaper-43.jpg" },
  { photoId: "wallpaper-44", name: "Wallpaper 44", priceCents: 100, r2Key: "wallpapers/wallpaper-44.jpg" },
  { photoId: "wallpaper-45", name: "Wallpaper 45", priceCents: 100, r2Key: "wallpapers/wallpaper-45.jpg" },
  { photoId: "wallpaper-46", name: "Wallpaper 46", priceCents: 100, r2Key: "wallpapers/wallpaper-46.jpg" },
  { photoId: "wallpaper-47", name: "Wallpaper 47", priceCents: 100, r2Key: "wallpapers/wallpaper-47.jpg" },
  { photoId: "wallpaper-48", name: "Wallpaper 48", priceCents: 100, r2Key: "wallpapers/wallpaper-48.jpg" },
  { photoId: "wallpaper-49", name: "Wallpaper 49", priceCents: 100, r2Key: "wallpapers/wallpaper-49.jpg" },
  { photoId: "wallpaper-50", name: "Wallpaper 50", priceCents: 100, r2Key: "wallpapers/wallpaper-50.jpg" },
  { photoId: "wallpaper-51", name: "Wallpaper 51", priceCents: 100, r2Key: "wallpapers/wallpaper-51.jpg" },
];

// Lookup helper used by src/index.js (checkout + download). Returns the
// catalog entry for a photoId, or null if it isn't a real product.
export function getWallpaper(photoId) {
  return catalog.find((w) => w.photoId === photoId) || null;
}
