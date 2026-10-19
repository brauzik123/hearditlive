// Random v4 UUID. crypto.randomUUID() only exists in secure contexts
// (HTTPS or localhost), so on a plain-http LAN address — e.g. testing the
// dev server from a phone at http://192.168.x.x:3000 — it's undefined.
// crypto.getRandomValues() works everywhere, so build one from that.
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
