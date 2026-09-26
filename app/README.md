# WakeStake app — mobile UI prototype

> U Snooze U Lose.

Frontend-only demo. Everything that will later hit a blockchain, wallet, AI or X/Twitter
runs on **mock services** — no real money, no real posts.

```sh
cd app
npm install
npm run dev            # http://localhost:5173
npm run dev:phone      # https://<your-LAN-ip>:5173 — open on your phone (same Wi-Fi), accept the cert warning
```

## Testing

```sh
npm run check          # typecheck + unit tests (vitest) + production build
npm test               # unit tests only: free-snooze/penalty/streak rules, alarm schedule, QR encode/decode, reducer
npm run test:e2e       # Playwright: builds, serves, clicks through the whole app in mobile Chrome
npm run test:e2e:ui    # same, in Playwright's interactive UI (watch it run, time-travel each step)
```

First e2e run only: `npx playwright install chromium`. The e2e suite covers onboarding, free snoozes →
warning ring → paid snoozes/escalation, the alarm re-ringing after a snooze (fake clock), receipt + shame post, rejecting wrong QR codes, waking by uploading the
downloaded QR, regenerating the code, persistence, and a **live-camera** scan (Chromium's fake
webcam plays a generated QR video).

Manual: `npm run dev`, walk through onboarding, use the dashboard's demo controls. The ↺ button resets.

## Demo flow

Welcome → Stake setup (mock wallet) → Alarm setup → Charity → **Dashboard**

From the dashboard: **Ring alarm now** (or **Simulate Snooze**). Snoozing silences the alarm for
the chosen snooze length (countdown screen; "Skip ahead" rings it immediately for demos):

1. The first *N* snoozes are **free** (set in stake setup: 0–3, default 2).
2. On the **last free** snooze the alarm warns you: if you're not up when it rings again, snoozing costs money.
3. After that every snooze is **paid**: stake slashed → Proof of Snooze receipt → public-shame X post.
   With "double or nothing" on, each paid snooze doubles ($5 → $10 → $20…).

Stake, snooze count, total lost and streak update on every snooze. The streak only breaks when you pay —
using your free snoozes is within the rules. **I'M UP** ends the session.
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
| `wallet`     | random address                     | viem wallet client / WalletConnect        |
| `stake`      | fake tx hashes                     | WakeStake escrow contract (deposit/slash) |
| `proof`      | random proof hash                  | on-chain receipt / Noir ZK proof          |
| `copywriter` | template strings                   | LLM-written shame post                    |
| `social`     | fake x.com URL                     | X API                                     |
| `charities`  | hardcoded list                     | curated registry                          |
| `wakeVerification` | local random secret, string compare | server-issued code + signed scan attestation (anti-screenshot) |
