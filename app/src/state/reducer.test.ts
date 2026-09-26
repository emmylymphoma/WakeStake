import { describe, expect, it } from 'vitest';
import { createInitialState } from '../domain/defaults';
import { dollars } from '../domain/money';
import { createMockServices } from '../services/createServices';
import { reducer } from './reducer';

describe('reducer + mock services', () => {
  it('runs a full onboarding → snooze → wake cycle', async () => {
    const services = createMockServices({ latencyMs: 0 });
    let s = createInitialState();

    const wallet = await services.wallet.connect();
    const stake = { amount: dollars(25), penaltyPerSnooze: dollars(5), escalating: true };
    await services.stake.deposit(wallet, stake.amount);
    s = reducer(s, { type: 'SET_STAKE', stake, wallet });
    s = reducer(s, { type: 'SET_ALARM', alarm: { ...s.alarm, legalSnoozes: 0 } });
    const account = await services.xAccount.connect({ handleHint: '@emmy' });
    s = reducer(s, { type: 'SET_BENEFICIARY', beneficiary: { kind: 'x', account } });
    expect(s.profile.handle).toBe('emmy');
    s = reducer(s, { type: 'COMPLETE_ONBOARDING' });
    expect(s.balance).toBe(dollars(25));

    s = reducer(s, { type: 'ALARM_RING', at: new Date().toISOString() });
    const pick = await services.charityOracle.pickCharity(s.beneficiary!);
    s = reducer(s, { type: 'CHARITY_PICKED', pick });
    const charity = pick.charity;
    const tx = await services.stake.slash({ wallet, amount: dollars(5), charity });
    const receipt = await services.proof.issueReceipt({
      tx,
      wallet,
      amount: dollars(5),
      charity,
      snoozeNumber: 1,
      at: '2026-09-26T07:00:00.000Z',
    });
    const text = await services.copywriter.writeShamePost({
      displayName: 'A',
      handle: 'a',
      penalty: dollars(5),
      charityName: charity.name,
      sessionSnoozeIndex: 0,
      stats: s.stats,
    });
    expect(text).toContain('#USnoozeULose');
    expect(receipt.txHash).toBe(tx.txHash);

    s = reducer(s, {
      type: 'SNOOZE_RECORDED',
      event: {
        id: 'x',
        at: '2026-09-26T07:00:00.000Z',
        penalty: dollars(5),
        balanceAfter: dollars(20),
        sessionSnoozeIndex: 0,
        receipt,
        post: { author: s.profile, text, createdAt: '2026-09-26T07:00:00.000Z' },
      },
    });
    expect(s.balance).toBe(dollars(20));
    expect(s.stats.snoozeCount).toBe(1);

    s = reducer(s, { type: 'WAKE' });
    expect(s.session).toBeNull();
    expect(s.stats.streak).toBe(0);

    expect(reducer(s, { type: 'RESET' })).toEqual(createInitialState());
  });
});
