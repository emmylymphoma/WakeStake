/**
 * Random hex string. Uses getRandomValues (not randomUUID) because the latter is
 * unavailable on plain-http LAN origins, which is how the demo is opened on a phone.
 */
export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const randomId = () => randomHex(8);
