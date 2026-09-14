/**
 * UUID v4, generated client-side. crypto.randomUUID is unavailable on pages
 * served over plain http (a LAN preview, for instance), so fall back to
 * getRandomValues rather than to something predictable.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h: string[] = [];
  for (let i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h
    .slice(6, 8)
    .join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

let lastIssued = 0;

/**
 * ISO 8601 in UTC, the only time format this app stores.
 *
 * Monotonic: firing off three thoughts in a row is the whole point of this
 * app, and Date.now() happily returns the same millisecond for all three.
 * Equal timestamps sort arbitrarily, which scrambles a thread. Nudging each
 * collision forward by a millisecond keeps createdAt strictly increasing
 * within a session while staying a truthful, valid timestamp.
 */
export function nowIso(): string {
  const now = Date.now();
  lastIssued = now > lastIssued ? now : lastIssued + 1;
  return new Date(lastIssued).toISOString();
}
