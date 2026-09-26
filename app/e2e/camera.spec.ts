import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createInitialState } from '../src/domain/defaults';
import type { AppState } from '../src/domain/types';
import { encodeWakeQr } from '../src/domain/wakeCode';
import { writeQrY4m } from './helpers';

// Chromium's fake webcam plays a video file; we point it at a generated QR "video".
const WAKE_CODE = { id: 'e2ecamera0000000000000000000000', createdAt: '2026-09-26T06:00:00.000Z' };
const dir = join(tmpdir(), 'wakestake-e2e');
mkdirSync(dir, { recursive: true });
const video = writeQrY4m(join(dir, 'bathroom-qr.y4m'), encodeWakeQr(WAKE_CODE));

test.use({
  browserName: 'chromium',
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  },
});

test('live camera scan of the bathroom QR stops the alarm', async ({ page }) => {
  const initial = createInitialState();
  const state: AppState = {
    ...initial,
    onboarded: true,
    profile: { displayName: 'Emmy', handle: 'emmysleeps' },
    wallet: { address: '0x' + '1'.repeat(40), network: 'mock' },
    balance: initial.stake.amount,
    charity: { id: 'amf', name: 'Against Malaria Foundation', tagline: '', emoji: '🦟', category: 'Health' },
    wakeCode: WAKE_CODE,
  };
  await page.addInitScript((s) => localStorage.setItem('wakestake:v1', s), JSON.stringify(state));

  await page.goto('/');
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  // No clicks: the scanner must pick the code up from the camera stream by itself.
  await expect(page.getByText('You’re up. Legend.')).toBeVisible({ timeout: 15_000 });
});
