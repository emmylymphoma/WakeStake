import { expect, test } from '@playwright/test';
import { expectTotalLost, onboard, stat, useLegalSnoozes, writeQrPng } from './helpers';

test('legal snoozes → warning → charity reveal → paid snoozes; QR wakes you', async ({ page }, info) => {
  const myQr = await onboard(page, info.outputDir);
  await expect(page.getByText('Bathroom QR armed')).toBeVisible();
  await expect(page.getByText('Your charity: classified')).toBeVisible();
  await expect(page.getByText('Be up by 7:00 AM')).toBeVisible();

  // 6:50 ring: legal snooze, alarm quiet for 5 minutes.
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await expect(page.getByText(/Snoozing is free for now/)).toBeVisible();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await expect(page.getByText('Snoozed · #1 this morning')).toBeVisible();
  await expect(page.getByLabel('Time until the alarm rings again')).toHaveText(/^[45]:\d\d$/);

  // 6:55 ring: the warning ring. Money is mentioned, the charity is not.
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  const warning = page.getByRole('alert');
  await expect(warning).toContainText('⚠️ Last free snooze');
  await expect(warning).toContainText('Be up by 7:00 AM');
  await expect(warning).toContainText('starting at $5 and doubling each time');
  await expect(warning).toContainText('a charity WakeStake picked for you');
  await page.getByRole('button', { name: 'Snooze · last free one' }).click();
  await expect(page.getByText('💸 It’s past 7:00 AM')).toBeVisible();

  // Nothing charged yet.
  await page.goto('/');
  await expect(page.locator('.stake-amount')).toContainText('$50');
  await expect(stat(page, 'Snoozes')).toHaveText('2');
  await expectTotalLost(page, '$0');

  // 7:00 ring: first illegal snooze → analyse X right now → one-time reveal before charging.
  await page.getByRole('button', { name: 'View snooze timer' }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await page.getByRole('button', { name: 'Snooze · −$5' }).click();
  await expect(page.getByText('⚠️ One-time warning')).toBeVisible();
  await expect(page.getByText('Reading @emmysleeps’s latest posts & likes')).toBeVisible();
  const revealed = page.getByTestId('revealed-charity');
  await expect(revealed).toBeVisible();
  const charityName = (await revealed.locator('.reveal-name').innerText()).trim();
  await expect(page.getByText(/Read @emmysleeps’s latest 200 posts/)).toBeVisible();
  expect(await stat(page, 'Stake left').count()).toBe(0); // not charged yet

  await page.getByRole('button', { name: 'Snooze anyway · −$5' }).click();
  await expect(page.getByText('SNOOZE DETECTED')).toBeVisible();
  await expect(page.locator('.penalty-amount')).toHaveText('−$5');
  await expect(page.getByText(`Sent to ${charityName}`)).toBeVisible();
  await expect(stat(page, 'Stake left')).toHaveText('$45');
  await expect(stat(page, 'Snoozes')).toHaveText('3');
  await expect(stat(page, 'Total lost')).toHaveText('$5');

  // Receipt + shame post exist for this snooze.
  await page.getByRole('button', { name: /Proof of Snooze/ }).click();
  await expect(page.getByText('PROOF OF SNOOZE')).toBeVisible();
  await expect(page.locator('.receipt')).toContainText(charityName);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /public shame/ }).click();
  await expect(page.locator('.x-text')).toContainText('#USnoozeULose');
  await page.getByRole('button', { name: /Post it/ }).click();
  await expect(page.getByText(/Posted/)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // Next illegal snooze: no second reveal, same charity, double the price.
  await page.getByRole('button', { name: /Back to sleep for 5 min \(next: −\$10\)/ }).click();
  await page.getByRole('button', { name: /Skip ahead · ring now/ }).click();
  await expect(page.getByRole('alert')).toContainText(`goes to ${charityName}`);
  await page.getByRole('button', { name: 'Snooze · −$10' }).click();
  await expect(page.locator('.penalty-amount')).toHaveText('−$10');
  await expect(page.getByText(`Sent to ${charityName}`)).toBeVisible();
  await expect(stat(page, 'Stake left')).toHaveText('$35');

  // "I'm up" demands the bathroom QR. A random QR is rejected…
  await page.getByRole('button', { name: /I’m up · go scan/ }).click();
  await expect(page.getByText('Scan your bathroom QR to stop the alarm.')).toBeVisible();
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
  await expect(stat(page, 'Total lost')).toHaveCount(0); // not on the dashboard: too depressing
  await expectTotalLost(page, '$15');
  await expect(stat(page, 'Streak')).toHaveText('0🔥');
  await expect(page.getByText('Your charity: classified')).toBeVisible();

  // Clean wake-up (no snooze) extends the streak.
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(myQr);
  await expect(page.getByText('You’re up.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(stat(page, 'Streak')).toHaveText('1🔥');

  // State survives a reload.
  await page.reload();
  await expect(page.locator('.stake-amount')).toContainText('$35');
  await expect(stat(page, 'Streak')).toHaveText('1🔥');
});

test('no X: the questionnaire decides — you fund the side you’re against', async ({ page }, info) => {
  const myQr = await onboard(page, info.outputDir, { questionnaire: { 'Do you like vegans?': 'No' } });
  await expect(page.getByText('Picked from your questionnaire')).toBeVisible();

  await useLegalSnoozes(page);
  await page.getByRole('button', { name: 'Snooze · −$5' }).click();
  await expect(page.getByText('Re-reading your questionnaire')).toBeVisible();
  await expect(page.getByTestId('revealed-charity')).toContainText('PETA');
  await expect(page.getByText('You said “No” on “Do you like vegans?”')).toBeVisible();

  // Getting up at the warning costs nothing.
  await page.getByRole('button', { name: /Fine, I’m up · scan QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(myQr);
  await expect(page.getByText('Up. Within the rules.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expectTotalLost(page, '$0');
});

test('no X linked: the shame post stays private', async ({ page }, info) => {
  await onboard(page, info.outputDir, { questionnaire: { Guns: 'Ban them' } });
  await useLegalSnoozes(page);
  await page.getByRole('button', { name: 'Snooze · −$5' }).click();
  await expect(page.getByTestId('revealed-charity')).toContainText('NRA Foundation');
  await page.getByRole('button', { name: 'Snooze anyway · −$5' }).click();
  await page.getByRole('button', { name: /public shame/ }).click();
  await expect(page.getByText('@(no X linked)')).toBeVisible();
  await expect(page.getByText('No X account linked, so this stays private.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Post it/ })).toHaveCount(0);
});

test('using only legal snoozes keeps the streak alive', async ({ page }, info) => {
  const myQr = await onboard(page, info.outputDir);
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await page.getByRole('button', { name: /Actually, I’m up · scan QR/ }).click();
  await page.getByTestId('qr-photo-input').setInputFiles(myQr);
  await expect(page.getByText('Up. Within the rules.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(stat(page, 'Streak')).toHaveText('1🔥');
  await expectTotalLost(page, '$0');
});

test('the alarm rings again by itself after exactly 5 minutes', async ({ page }, info) => {
  await page.clock.install();
  await onboard(page, info.outputDir);
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · free (1 left after)' }).click();
  await expect(page.getByText('Snoozed · #1 this morning')).toBeVisible();

  await page.clock.fastForward('04:30');
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
  await expect(page.getByText(/but not yours/)).toBeVisible();
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
  await expect(page.getByText(/but not yours/)).toBeVisible();
});
