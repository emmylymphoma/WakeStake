# WakeStake app — mobile UI prototype

> U Snooze U Lose.

By default everything that hits a blockchain, wallet, AI or X/Twitter runs on **mock services**:
no real money, no real posts. See [Real transactions](#real-transactions-chain-mode) to use the real contract.

```sh
cd app
npm install
npm run dev            # http://localhost:5173
npm run dev:phone      # https://<your-LAN-ip>:5173 — open on your phone (same Wi-Fi), accept the cert warning
```

## Testing

```sh
npm run check          # typecheck + unit tests (vitest) + production build
npm test               # unit tests only: legal-snooze/penalty/streak rules, alarm timeline, charity pick, alarm schedule, QR encode/decode, reducer
npm run test:e2e       # Playwright: builds, serves, clicks through the whole app in mobile Chrome
npm run test:e2e:ui    # same, in Playwright's interactive UI (watch it run, time-travel each step)
```

First e2e run only: `npx playwright install chromium`. The e2e suite covers onboarding (X and questionnaire), legal snoozes →
warning ring → one-time charity reveal → paid snoozes/escalation, the alarm re-ringing after 5 minutes (fake clock), receipt + shame post, rejecting wrong QR codes, waking by uploading the
downloaded QR, regenerating the code, persistence, and a **live-camera** scan (Chromium's fake
webcam plays a generated QR video).

Manual: `npm run dev`, walk through onboarding, use the dashboard's demo controls. The ↺ button resets.

## Real transactions (chain mode)

Without config the app runs on mocks. With `VITE_CHAIN` set (see [.env.example](.env.example)) the **wallet**
and **stake** services are real: an injected wallet (MetaMask) and the WakeStake contract, with the
Noir/UltraHonk proofs generated in the browser. Everything else (X, AI copy, charity oracle) stays mocked.

The contract is **all or nothing**, so in chain mode the per-snooze penalty settings are replaced by:

| Step | On-chain |
| ---- | -------- |
| Arm the alarm (onboarding step 2) | mint test tokens if needed → `approve` → `stake()`, locked until your next wake-by time |
| Scan bathroom QR before wake-by | ZK proof → `wake()`: same stake, rolled over to the next wake-by |
| First snooze after wake-by | ZK proof → `withdraw(lose=true)`: the whole stake to `VITE_DONATION_ADDRESS`, minus the fee |

The bathroom QR code **is** the circuit's `secret`, so "I'm up" can only be proven with it. Notes (needed
to ever move the stake again) are kept in localStorage under `wakestake:notes:v1`; the ↺ demo reset
doesn't touch them. Proofs need the repo-root dependencies: run `pnpm install` in the root first.

**Local chain** (from the repo root, then `cd app && npm run dev`):

```sh
pnpm hardhat node                                              # terminal 1
pnpm hardhat run scripts/deploy-local.ts --network localhost   # deploys + writes app/.env.local
```

Add the Hardhat network to MetaMask (RPC `http://127.0.0.1:8545`, chain id 31337) and import a Hardhat test
account. `npm run test:e2e:chain` runs the whole stake → wake → oversleep → slash cycle against it
(`CHAIN_E2E_BUILD=1` for the production build).

**Sepolia**: the contract is already deployed. Deploy a test token (see `.env.example`), set
`VITE_CHAIN=sepolia`, `VITE_TOKEN_ADDRESS` and `VITE_DONATION_ADDRESS` in `app/.env.local`. You need Sepolia ETH for gas.
To demo a slash, set the wake-by time a few minutes ahead: the contract only releases a stake after its deadline.

After changing the circuit, `pnpm build:verifier` in the root also copies the compiled circuit into the app.

## Demo flow

Welcome → Stake (mock wallet) → Alarm → **Beneficiary** (connect X *or* questionnaire) → Bathroom QR → Dashboard

**Alarm.** You set the time you *must be up* and how many **legal snoozes** you get (0–3).
Snoozes are always **5 minutes**, and legal snoozes happen *before* your wake-up time — the alarm
starts early. Must be up at 7:00 with 2 legal snoozes:

| Ring | What happens |
| ---- | ------------ |
| 6:50 | Snooze is free |
| 6:55 | Last legal snooze — warning: after 7:00 snoozing costs money and goes to a charity we picked |
| 7:00 | Snoozing now costs $5 (then $10, $20… with double-or-nothing) |

**Charity.** You never pick it. WakeStake picks one you'd *hate* funding, from your X account or,
without X, a short questionnaire. It stays hidden ("classified") until your **first illegal snooze**
of a morning: tapping snooze runs the analysis *right then* and shows a one-time warning with the
charity and why it was picked — "Snooze anyway" or get up. Every later illegal snooze that morning
goes to the same charity; the next morning it's analysed fresh.

Paid snoozes: stake slashed → Proof of Snooze receipt → public-shame X post (private if no X is linked).
Stake, snooze count, total lost and streak update on every snooze. The streak only breaks when you pay.
**I'M UP** means scanning your bathroom QR.

State persists in localStorage; the ↺ button on the dashboard resets the demo.

### Bathroom QR wake verification

Onboarding step 4 generates a personal QR (download PNG / print). Once set up, every
"I'm up" goes to a scan screen and the alarm only stops when **your** code is scanned —
other QR codes and other users' WakeStake codes are rejected. The code can be reprinted or
regenerated (invalidating the old printout) from the dashboard.

- Live scanning uses the camera (`getUserMedia` + jsQR). Browsers only allow the camera on
  HTTPS or localhost — hence `npm run dev:phone`.
- "Take a photo of the code instead" works everywhere, including plain http.
- "Simulate scan (demo only)" skips the bathroom trip for demos. Remove it before launch.

## Architecture

```
src/
  domain/      Pure types + rules (penalty, streak, alarm schedule). No React, no I/O. Unit-tested.
  services/    Interfaces (types.ts) + mock/ implementations, wired in createServices.ts
  state/       Reducer + context + localStorage persistence (reducer delegates to domain/rules)
  flows/       Hooks that sequence services (useSnoozeFlow: slash → receipt → shame post)
  navigation/  Tiny stack navigator
  screens/     One file per screen
  components/  Shared UI primitives
```

Screens only talk to services through `useServices()`. To go live, implement the interface
in `services/types.ts` and swap the entry in `createServices.ts` (or pass `services` to `<App>`):

| Service      | Mock today                         | Real implementation later                 |
| ------------ | ---------------------------------- | ----------------------------------------- |
| `wallet`     | random address                     | ✅ injected wallet via viem (`services/chain`) |
| `stake`      | fake tx hashes                     | ✅ WakeStake contract + in-browser ZK proofs (`services/chain`) |
| `proof`      | random proof hash                  | receipt carries the real tx + proof hash in chain mode |
| `copywriter` | template strings                   | LLM-written shame post                    |
| `social`     | fake x.com URL                     | X API                                     |
| `xAccount`   | fake consent sheet                 | X OAuth 2.0 (PKCE), tokens server-side    |
| `charityOracle` | hash of handle+date / questionnaire scores | X API read at snooze time + LLM, picks from a vetted charity registry |
| `wakeVerification` | local random secret, string compare | server-issued code + signed scan attestation (anti-screenshot) |
