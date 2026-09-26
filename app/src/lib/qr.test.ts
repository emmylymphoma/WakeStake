import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { decodeQr } from './qr';

/** Rasterise a QR into RGBA pixels (what a camera frame gives the decoder). */
function render(text: string, scale = 6, quiet = 4) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = (modules.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

describe('decodeQr', () => {
  it('round-trips a wake code', () => {
    const text = 'wakestake:wake:v1:0123456789abcdef0123456789abcdef';
    expect(decodeQr(render(text))).toBe(text);
  });

  it('returns null for a blank frame', () => {
    const blank = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
    expect(decodeQr(blank)).toBeNull();
  });
});
