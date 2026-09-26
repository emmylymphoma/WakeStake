import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createPublicClient, http, parseAbi, parseUnits, type Address } from 'viem';
import { hardhat } from 'viem/chains';

const RPC_URL = 'http://127.0.0.1:8545';
// Hardhat node account #2. The node keeps its accounts unlocked, so the fake wallet below
// just forwards everything (including eth_sendTransaction) to the node.
const SLEEPER: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
// Account #0 deployed WakeStake, so it gets the fee.
const FEE_COLLECTOR: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('=') as [string, string]),
);
const wakeStake = env.VITE_WAKESTAKE_ADDRESS as Address;
const token = env.VITE_TOKEN_ADDRESS as Address;
const charity = env.VITE_DONATION_ADDRESS as Address;

const client = createPublicClient({ chain: hardhat, transport: http(RPC_URL) });
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
const balanceOf = (who: Address) => client.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [who] });
const rpc = (method: string, params: unknown[] = []) => client.request({ method, params } as never);

const STAKE = parseUnits('50', 18);

async function injectWallet(page: Page) {
  await page.addInitScript(
    ({ rpcUrl, account }) => {
      (window as unknown as { ethereum: unknown }).ethereum = {
        async request({ method, params }: { method: string; params?: unknown[] }) {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }),
          });
          const json = await res.json();
          if (json.error) throw Object.assign(new Error(json.error.message), json.error);
          return json.result;
        },
        on() {},
        removeListener() {},
      };
    },
    { rpcUrl: RPC_URL, account: SLEEPER },
  );
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

test('stake → wake with a ZK proof → oversleep → whole stake goes to charity', async ({ page }) => {
  await injectWallet(page);
  // Earlier runs moved the node's clock forward: run the browser on chain time.
  const chainNow = new Date(Number((await client.getBlock()).timestamp) * 1000 + 60_000);
  await page.clock.install({ time: chainNow });
  const contractBefore = await balanceOf(wakeStake);
  const charityBefore = await balanceOf(charity);
  const feeBefore = await balanceOf(FEE_COLLECTOR);

  await page.goto('/');
  await expect(page.getByText('Real transactions: your stake is locked')).toBeVisible();
  await page.getByPlaceholder('Your name').fill('Emmy');
  await page.getByRole('button', { name: /Put money on it/ }).click();
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(page.getByText('All or nothing.')).toBeVisible();
  await page.getByRole('button', { name: 'Stake $50' }).click();

  // Deadline in 30 min, every day, no legal snoozes: the first snooze after the deadline costs everything.
  await page.locator('input[type="time"]').fill(hhmm(new Date(chainNow.getTime() + 30 * 60_000)));
  await page.getByRole('radiogroup', { name: 'Legal snoozes' }).getByRole('radio', { name: /^0/ }).click();
  const offDays = page.locator('.day[aria-pressed="false"]');
  while ((await offDays.count()) > 0) await offDays.first().click();
  await page.getByRole('button', { name: 'Arm & lock $50' }).click(); // mint + approve + stake()
  await expect(page.getByText('Who gets your money?')).toBeVisible({ timeout: 60_000 });
  expect(await balanceOf(wakeStake)).toBe(contractBefore + STAKE);

  await page.getByRole('button', { name: 'Connect X account' }).click();
  await page.getByRole('dialog').getByPlaceholder('snoozelord').fill('emmysleeps');
  await page.getByRole('button', { name: 'Authorize app' }).click();
  await page.getByRole('button', { name: /Next: bathroom QR/ }).click();
  await page.getByRole('button', { name: /on the wall/ }).click();
  await expect(page.getByText('Stake at risk')).toBeVisible();
  await expect(page.getByText(/costs all of it/)).toBeVisible();

  // Up on time: the bathroom QR's secret goes into an UltraHonk proof, generated in the browser, then wake().
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: /I’M UP · scan bathroom QR/ }).click();
  await page.getByRole('button', { name: 'Simulate scan (demo only)' }).click();
  await expect(page.getByText('You’re up.')).toBeVisible({ timeout: 180_000 });
  expect(await balanceOf(wakeStake)).toBe(contractBefore + STAKE); // re-staked for tomorrow, not withdrawn

  // Sleep through tomorrow's deadline.
  await rpc('evm_increaseTime', [25 * 60 * 60]);
  await rpc('evm_mine');
  await page.clock.fastForward('25:00:00');

  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await page.getByRole('button', { name: /Ring alarm now/ }).click();
  await page.getByRole('button', { name: 'Snooze · −$50' }).click();
  await expect(page.getByTestId('revealed-charity')).toBeVisible();
  await page.getByRole('button', { name: 'Snooze anyway · −$50' }).click(); // proof + withdraw(lose)
  await expect(page.getByText('SNOOZE DETECTED')).toBeVisible({ timeout: 180_000 });

  expect(await balanceOf(wakeStake)).toBe(contractBefore);
  expect(await balanceOf(charity)).toBe(charityBefore + (STAKE * 90n) / 100n);
  expect(await balanceOf(FEE_COLLECTOR)).toBe(feeBefore + (STAKE * 10n) / 100n);

  await page.getByRole('button', { name: /Proof of Snooze/ }).click();
  await expect(page.getByText('Settled on-chain with a zero-knowledge proof.')).toBeVisible();

  // Change of heart: re-stake, then cash the whole stake back out with an on-time proof. No fee.
  await page.goto('/'); // persisted users land on the dashboard
  await page.getByRole('button', { name: 'Re-stake $50' }).click();
  await expect(page.getByRole('button', { name: 'Cash out $50' })).toBeVisible({ timeout: 60_000 });
  expect(await balanceOf(wakeStake)).toBe(contractBefore + STAKE);
  const sleeperBefore = await balanceOf(SLEEPER);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cash out $50' }).click(); // proof + withdraw(lose=false)
  await expect(page.getByText('Stake withdrawn.')).toBeVisible({ timeout: 180_000 });

  expect(await balanceOf(wakeStake)).toBe(contractBefore);
  expect(await balanceOf(SLEEPER)).toBe(sleeperBefore + STAKE);
  expect(await balanceOf(FEE_COLLECTOR)).toBe(feeBefore + (STAKE * 10n) / 100n); // unchanged: no fee on a cash-out
});
