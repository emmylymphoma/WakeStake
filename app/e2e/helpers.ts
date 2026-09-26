import { writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';
import { DONT_CARE, QUESTIONS } from '../src/domain/questionnaire';

/** questionnaire: prompt → side label. Every other question gets “Don’t care”. */
export type OnboardVia = { x: string } | { questionnaire: Record<string, string> };

/** Walks through onboarding. Returns the path of the downloaded bathroom QR PNG. */
export async function onboard(page: Page, downloadDir: string, via: OnboardVia = { x: 'emmysleeps' }): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Sleepy McSnoozeface').fill('Emmy');
  await page.getByRole('button', { name: /Put money on it/ }).click();

  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.getByRole('button', { name: 'Stake $50' }).click();

  // Defaults: be up by 7:00 with 2 legal snoozes → alarm starts at 6:50.
  await expect(page.getByText('What time do you actually need to be up?')).toBeVisible();
  const timeline = page.getByRole('list', { name: 'Your morning' });
  await expect(timeline).toContainText('6:50 AM');
  await expect(timeline).toContainText('6:55 AMLast legal snooze');
  await expect(timeline).toContainText('7:00 AMBe up. Snoozing now costs money');
  await page.getByRole('button', { name: 'Arm & lock $50' }).click();

  await expect(page.getByText('Who gets your money? Not your call.')).toBeVisible();
  if ('x' in via) {
    await page.getByRole('button', { name: 'Connect X account' }).click();
    await page.getByRole('dialog').getByPlaceholder('snoozelord').fill(via.x);
    await page.getByRole('button', { name: 'Authorize app' }).click();
    await expect(page.getByText(`✓ Connected as @${via.x}`)).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Take the questionnaire' }).click();
    for (const q of QUESTIONS) {
      const answer = via.questionnaire[q.prompt] ?? DONT_CARE;
      await page.getByRole('radiogroup', { name: q.prompt }).getByRole('radio', { name: answer, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Lock in my answers' }).click();
    await expect(page.getByText('✓ Questionnaire done')).toBeVisible();
  }
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

/** Uses both legal snoozes (6:50 and 6:55 rings) so the next ring is the 7:00 one. */
export async function useLegalSnoozes(page: Page) {
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await page.getByRole('button', { name: 'Snooze · last free one' }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
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

/** "Total lost" lives in Settings, not on the dashboard. Opens Settings, checks, comes back. */
export async function expectTotalLost(page: Page, value: string) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(stat(page, 'Total lost')).toHaveText(value);
  await page.getByRole('button', { name: 'Back' }).click();
}

/** Numeric value of a stat tile on the dashboard/penalty screen. */
export function stat(page: Page, label: string) {
  return page.locator('.stat', { has: page.getByText(label, { exact: true }) }).locator('.stat-value');
}
