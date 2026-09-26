import jsQR from 'jsqr';
import QRCode from 'qrcode';

/** PNG data URL for printing/downloading. */
export function qrToDataUrl(text: string, width = 640): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Decode a QR from raw RGBA pixels. Returns null if none is found. */
export function decodeQr({ data, width, height }: Pixels): string | null {
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

/** Decode a QR from an image file (camera photo / screenshot). */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    // Downscale huge phone photos — jsQR is faster and just as accurate at ~1000px.
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return decodeQr(ctx.getImageData(0, 0, width, height));
  } finally {
    bitmap.close();
  }
}
