// src/zip.js
//
// Minimal streaming-friendly ZIP writer (STORE / no compression).
//
// Why STORE: the gallery files are JPEGs, already compressed — deflate would
// burn CPU for ~0% gain. STORE just frames each file with zip headers.
//
// Design: the caller buffers ONE file at a time (each is small, ~10-15MB),
// so we always know a file's CRC-32 and size *before* writing its local
// header. That avoids data descriptors entirely and keeps memory ~one file
// no matter how large the whole archive is.
//
// ZIP64: each individual file is < 4GB, so local headers stay 32-bit. ZIP64
// is only emitted where it can actually be needed for a multi-GB archive:
//   - a central-directory entry whose local-header offset exceeds 4GB
//   - the end-of-central-directory totals (size/offset/count)
// Both are handled conditionally below.

const U32_MAX = 0xffffffff;

// --- CRC-32 (IEEE 802.3), table-based ---------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, seed = 0) {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// --- little-endian writers into a growable byte list ------------------
function pushU16(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff); }
function pushU32(arr, v) {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}
function pushU64(arr, v) {
  // v may exceed 32 bits but stays well under 2^53 for our sizes.
  const low = v >>> 0;
  const high = Math.floor(v / 0x100000000) >>> 0;
  pushU32(arr, low);
  pushU32(arr, high);
}

const DOS_EPOCH = 1980;

function dosDateTime(date) {
  const y = date.getUTCFullYear();
  if (y < DOS_EPOCH) return { time: 0, date: (1 << 5) | 1 }; // 1980-01-01
  const time =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    (Math.floor(date.getUTCSeconds() / 2) & 0x1f);
  const dosDate =
    ((y - DOS_EPOCH) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

// General-purpose flag bit 11 = filename is UTF-8.
const FLAG_UTF8 = 0x0800;

// --- header builders --------------------------------------------------
// Local file header + filename (no extra field; sizes/crc are known).
export function buildLocalHeader({ nameBytes, crc, size, date }) {
  const { time, date: dosDate } = dosDateTime(date);
  const a = [];
  pushU32(a, 0x04034b50); // signature
  pushU16(a, 20);         // version needed (2.0)
  pushU16(a, FLAG_UTF8);  // flags
  pushU16(a, 0);          // method: store
  pushU16(a, time);
  pushU16(a, dosDate);
  pushU32(a, crc);
  pushU32(a, size);       // compressed
  pushU32(a, size);       // uncompressed
  pushU16(a, nameBytes.length);
  pushU16(a, 0);          // extra length
  const head = new Uint8Array(a);
  const out = new Uint8Array(head.length + nameBytes.length);
  out.set(head, 0);
  out.set(nameBytes, head.length);
  return out;
}

// Central directory header for one entry. Adds a ZIP64 extra field only if
// the local-header offset exceeds 4GB.
export function buildCentralHeader({ nameBytes, crc, size, offset, date }) {
  const { time, date: dosDate } = dosDateTime(date);
  const needsZip64 = offset > U32_MAX;

  const extra = [];
  if (needsZip64) {
    pushU16(extra, 0x0001);   // ZIP64 extra field id
    pushU16(extra, 8);        // size of following data (just the 8-byte offset)
    pushU64(extra, offset);
  }

  const a = [];
  pushU32(a, 0x02014b50);            // signature
  pushU16(a, 45);                    // version made by
  pushU16(a, needsZip64 ? 45 : 20);  // version needed
  pushU16(a, FLAG_UTF8);
  pushU16(a, 0);                     // method: store
  pushU16(a, time);
  pushU16(a, dosDate);
  pushU32(a, crc);
  pushU32(a, size);                  // compressed
  pushU32(a, size);                  // uncompressed
  pushU16(a, nameBytes.length);
  pushU16(a, extra.length);          // extra length
  pushU16(a, 0);                     // comment length
  pushU16(a, 0);                     // disk number start
  pushU16(a, 0);                     // internal attrs
  pushU32(a, 0);                     // external attrs
  pushU32(a, needsZip64 ? U32_MAX : offset); // local header offset
  const head = new Uint8Array(a);
  const out = new Uint8Array(head.length + nameBytes.length + extra.length);
  out.set(head, 0);
  out.set(nameBytes, head.length);
  out.set(new Uint8Array(extra), head.length + nameBytes.length);
  return out;
}

// End-of-central-directory (with ZIP64 records when the archive is large).
export function buildEnd({ count, cdSize, cdOffset }) {
  const needsZip64 =
    count >= 0xffff || cdSize > U32_MAX || cdOffset > U32_MAX;

  const a = [];
  if (needsZip64) {
    const zip64EocdOffset = cdOffset + cdSize;
    // ZIP64 end of central directory record
    pushU32(a, 0x06064b50);
    pushU64(a, 44);          // size of remainder of this record
    pushU16(a, 45);          // version made by
    pushU16(a, 45);          // version needed
    pushU32(a, 0);           // this disk number
    pushU32(a, 0);           // disk with cd start
    pushU64(a, count);       // entries on this disk
    pushU64(a, count);       // total entries
    pushU64(a, cdSize);
    pushU64(a, cdOffset);
    // ZIP64 EOCD locator
    pushU32(a, 0x07064b50);
    pushU32(a, 0);           // disk with zip64 eocd
    pushU64(a, zip64EocdOffset);
    pushU32(a, 1);           // total disks
  }

  // Standard EOCD (with sentinels when ZIP64 is in play)
  pushU32(a, 0x06054b50);
  pushU16(a, 0);                                  // disk number
  pushU16(a, 0);                                  // disk with cd
  pushU16(a, needsZip64 ? 0xffff : count);        // entries this disk
  pushU16(a, needsZip64 ? 0xffff : count);        // total entries
  pushU32(a, needsZip64 ? U32_MAX : cdSize);
  pushU32(a, needsZip64 ? U32_MAX : cdOffset);
  pushU16(a, 0);                                  // comment length
  return new Uint8Array(a);
}

// Convenience: build a complete archive in memory from [{name, data}].
// Used by tests; the Worker streams instead (see handleGalleryZip).
export function zipSync(files, date = new Date()) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const crc = crc32(data);
    const lh = buildLocalHeader({ nameBytes, crc, size: data.length, date });
    parts.push(lh, data);
    central.push({ nameBytes, crc, size: data.length, offset, date });
    offset += lh.length + data.length;
  }
  const cdOffset = offset;
  let cdSize = 0;
  const cdParts = [];
  for (const e of central) {
    const ch = buildCentralHeader(e);
    cdParts.push(ch);
    cdSize += ch.length;
  }
  const end = buildEnd({ count: central.length, cdSize, cdOffset });

  const total = cdOffset + cdSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...parts, ...cdParts, end]) { out.set(part, p); p += part.length; }
  return out;
}
