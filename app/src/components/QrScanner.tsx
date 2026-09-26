import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { decodeQr, decodeQrFromFile } from '../lib/qr';
import { Button } from './ui';

type CameraStatus = 'starting' | 'scanning' | 'unavailable' | 'denied' | 'error';

const SCAN_INTERVAL_MS = 150;
/** Ignore the same text re-appearing in consecutive frames for this long. */
const REPEAT_COOLDOWN_MS = 2000;
const MAX_FRAME_SIDE = 640;

const STATUS_TEXT: Record<Exclude<CameraStatus, 'scanning'>, string> = {
  starting: 'Starting camera…',
  unavailable: 'Live camera needs HTTPS (or localhost). Take a photo of the code instead.',
  denied: 'Camera access was blocked. Allow it in your browser settings, or take a photo instead.',
  error: 'Couldn’t start the camera. Take a photo of the code instead.',
};

/**
 * Live QR scanner (getUserMedia + jsQR) with a photo-upload fallback, which also works
 * on plain-http origins where browsers refuse camera access.
 */
export function QrScanner({ onResult, disabled = false }: { onResult: (text: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onResultRef = useRef(onResult);
  const disabledRef = useRef(disabled);
  onResultRef.current = onResult;
  disabledRef.current = disabled;

  const [status, setStatus] = useState<CameraStatus>('starting');
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }

    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastScan = 0;
    let last = { text: '', at: 0 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!ctx || !video || video.readyState < video.HAVE_ENOUGH_DATA || now - lastScan < SCAN_INTERVAL_MS) return;
      lastScan = now;
      const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const text = decodeQr(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (!text || disabledRef.current) return;
      if (text === last.text && now - last.at < REPEAT_COOLDOWN_MS) return;
      last = { text, at: now };
      onResultRef.current(text);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        setStatus('scanning');
        raf = requestAnimationFrame(tick);
      })
      .catch((e: unknown) => {
        if (stopped) return;
        setStatus(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'error');
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoMessage(null);
    const text = await decodeQrFromFile(file).catch(() => null);
    if (text) onResult(text);
    else setPhotoMessage('No QR code found in that photo. Get closer, better light.');
  };

  const live = status === 'scanning' || status === 'starting';

  return (
    <div className="scanner">
      <div className={`scanner-view ${live ? '' : 'scanner-view-off'}`}>
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        {status === 'scanning' ? (
          <>
            <div className="scanner-frame" aria-hidden />
            <div className="scanner-line" aria-hidden />
          </>
        ) : (
          <p className="scanner-status">{STATUS_TEXT[status]}</p>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="qr-photo-input"
        onChange={onPhoto}
      />
      <Button variant="secondary" disabled={disabled} onClick={() => fileRef.current?.click()}>
        📷 Take a photo of the code instead
      </Button>
      {photoMessage ? <p className="fine-print text-danger">{photoMessage}</p> : null}
    </div>
  );
}
