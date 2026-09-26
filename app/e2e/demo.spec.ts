import { expect, test } from '@playwright/test';
import { onboard, stat, writeQrPng } from './helpers';

test('free snoozes → warning → paid snoozes update stake, count, total lost and streak; QR wakes you', async ({
  page,
}, info) => {
  const myQr = await onboard(page, info.outputDir);
  await expect(page.getByText('Bathroom QR armed')).toBeVisible();

  // Default: 2 free snoozes. Snooze #1 is free and the alarm goes quiet.
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await expect(page.getByText(/Snoozing is free for now/)).toBeVisible();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await expect(page.getByText('Snoozed · #1 this morning')).toBeVisible();
  await expect(page.getByLabel('Time until the alarm rings again')).toHaveText(/^[89]:\d\d$/);

  // It rings again: this is the warning ring.
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await expect(page.getByText('⚠️ Last free snooze')).toBeVisible();
  await expect(page.getByText(/starting at \$5 and doubling each time/)).toBeVisible();
  await page.getByRole('button', { name: 'Snooze · last free one' }).click();
  await expect(page.getByText('💸 Free snoozes are gone')).toBeVisible();

  // Nothing charged yet.
  await page.goto('/');
  await expect(page.locator('.stake-amount')).toContainText('$50');
  await expect(stat(page, 'Snoozes')).toHaveText('2');
  await expect(stat(page, 'Total lost')).toHaveText('$0');

  // Third ring: snoozing now costs the base $5.
  await page.getByRole('button', { name: 'View snooze timer' }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await page.getByRole('button', { name: 'Snooze · −$5' }).click();
  await expect(page.getByText('SNOOZE DETECTED')).toBeVisible();
  await expect(page.locator('.penalty-amount')).toHaveText('−$5');
  await expect(stat(page, 'Stake left')).toHaveText('$45');
  await expect(stat(page, 'Snoozes')).toHaveText('3');
  await expect(stat(page, 'Total lost')).toHaveText('$5');

  // Receipt + shame post exist for this snooze.
  await page.getByRole('button', { name: /Proof of Snooze/ }).click();
  await expect(page.getByText('PROOF OF SNOOZE')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /public shame/ }).click();
  await expect(page.locator('.x-text')).toContainText('#USnoozeULose');
  await page.getByRole('button', { name: /Post it/ }).click();
  await expect(page.getByText(/Posted/)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // Double or nothing: the next paid snooze costs $10.
  await page.getByRole('button', { name: /Back to sleep for 9 min \(next: −\$10\)/ }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await page.getByRole('button', { name: 'Snooze · −$10' }).click();
  await expect(page.locator('.penalty-amount')).toHaveText('−$10');
  await expect(stat(page, 'Stake left')).toHaveText('$35');

  // "I'm up" demands the bathroom QR. A random QR is rejected…
  await page.getByRole('button', { name: /I’m up · go scan/ }).click();
  await expect(page.getByText('Prove it. Go scan your bathroom QR.')).toBeVisible();
  const input = page.getByTestId('qr-photo-input');
  await input.setInputFiles(await writeQrPng(`${info.outputDir}/cereal-box.png`, 'https://example.com/cereal'));
  await expect(page.getByText(/not your bathroom QR/)).toBeVisible();

  // …the downloaded one works.
  await input.setInputFiles(myQr);
  await expect(page.getByText('Up. Eventually.')).toBeVisible();
  await expect(page.getByText('4 snoozes cost you $15 this morning.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(page.locator('.stake-amount')).toContainText('$35');
  await expect(stat(page, 'Snoozes')).toHaveText('4');
  await expect(stat(page, 'Total lost')).toHaveText('$15');
  await expect(stat(page, 'Streak')).toHaveText('0🔥');

  // Clean wake-up (no snooze) extends the streak.
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(myQr);
  await expect(page.getByText('You’re up. Legend.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(stat(page, 'Streak')).toHaveText('1🔥');

  // State survives a reload.
  await page.reload();
  await expect(page.locator('.stake-amount')).toContainText('$35');
  await expect(stat(page, 'Streak')).toHaveText('1🔥');
});

test('using only free snoozes keeps the streak alive', async ({ page }, info) => {
  const myQr = await onboard(page, info.outputDir);
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await page.getByRole('button', { name: /Actually, I’m up · scan QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(myQr);
  await expect(page.getByText('Up. Within the rules.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(stat(page, 'Streak')).toHaveText('1🔥');
  await expect(stat(page, 'Total lost')).toHaveText('$0');
});

test('the alarm rings again by itself when the snooze runs out', async ({ page }, info) => {
  await page.clock.install();
  await onboard(page, info.outputDir);
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await expect(page.getByText('Snoozed · #1 this morning')).toBeVisible();

  await page.clock.fastForward('08:30');
  await expect(page.getByText('Snoozed · #1 this morning')).toBeVisible();
  await page.clock.fastForward('00:45');
  await expect(page.getByText('⚠️ Last free snooze')).toBeVisible();
});

test('another user’s WakeStake QR is rejected', async ({ page }, info) => {
  await onboard(page, info.outputDir);
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  await page
    .getByTestId('qr-photo-input')
    .setInputFiles(await writeQrPng(`${info.outputDir}/friend.png`, 'wakestake:wake:v1:someoneelse'));
  await expect(page.getByText(/not yours\. Nice try/)).toBeVisible();
});

test('regenerating the code invalidates the old printout', async ({ page }, info) => {
  const oldQr = await onboard(page, info.outputDir);
  page.on('dialog', (d) => d.accept());
  await page.getByText('Bathroom QR armed').click();
  const before = await page.getByAltText('Your bathroom wake-up QR code').getAttribute('src');
  await page.getByRole('button', { name: 'Generate a new code' }).click();
  await expect(page.getByAltText('Your bathroom wake-up QR code')).not.toHaveAttribute('src', before!);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(oldQr);
  await expect(page.getByText(/not yours\. Nice try/)).toBeVisible();
});
