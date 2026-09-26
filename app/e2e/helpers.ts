import { writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';

/** Walks through onboarding. Returns the path of the downloaded bathroom QR PNG. */
export async function onboard(page: Page, downloadDir: string): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Sleepy McSnoozeface').fill('Emmy');
  await page.getByPlaceholder('snoozelord').fill('@emmysleeps');
  await page.getByRole('button', { name: /Put money on it/ }).click();

  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.getByRole('button', { name: 'Lock $50' }).click();

  await expect(page.getByText('When does the pain start?')).toBeVisible();
  await page.getByRole('button', { name: 'Arm the alarm' }).click();

  await page.getByRole('radio', { name: /Against Malaria Foundation/ }).click();
  await page.getByRole('button', { name: /Next: bathroom QR/ }).click();

  await expect(page.getByAltText('Your bathroom wake-up QR code')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download PNG/ }).click();
  const qrPath = `${downloadDir}/bathroom-qr.png`;
  await (await download).saveAs(qrPath);

  await page.getByRole('button', { name: /on the wall/ }).click();
  await expect(page.getByText('Stake at risk')).toBeVisible();
  return qrPath;
}

export async function writeQrPng(path: string, text: string): Promise<string> {
  await QRCode.toFile(path, text, { width: 400, margin: 2 });
  return path;
}

/**
 * Writes a one-frame Y4M video of a QR code. Chromium loops it as a fake webcam
 * (--use-file-for-fake-video-capture), which exercises the real live-camera scan path.
 */
export function writeQrY4m(path: string, text: string, size = 480): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const quiet = 4;
  const cell = Math.floor(size / (modules.size + quiet * 2));
  const offset = Math.floor((size - cell * modules.size) / 2);
  const y = Buffer.alloc(size * size, 235); // white (studio-range luma)
  for (let my = 0; my < modules.size; my++) {
    for (let mx = 0; mx < modules.size; mx++) {
      if (!modules.get(my, mx)) continue;
      for (let dy = 0; dy < cell; dy++) {
        const row = (offset + my * cell + dy) * size;
        y.fill(16, row + offset + mx * cell, row + offset + (mx + 1) * cell);
      }
    }
  }
  const chroma = Buffer.alloc((size / 2) * (size / 2) * 2, 128); // neutral U + V
  const header = `YUV4MPEG2 W${size} H${size} F30:1 Ip A1:1 C420jpeg\nFRAME\n`;
  writeFileSync(path, Buffer.concat([Buffer.from(header), y, chroma]));
  return path;
}

/** Numeric value of a stat tile on the dashboard/penalty screen. */
export function stat(page: Page, label: string) {
  return page.locator('.stat', { has: page.getByText(label, { exact: true }) }).locator('.stat-value');
}
