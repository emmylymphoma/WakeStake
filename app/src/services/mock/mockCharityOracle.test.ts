import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../../domain/questionnaire';
import { createMockCharityOracleService, MOCK_CAUSES } from './mockCharityOracle';

const oracle = createMockCharityOracleService(0);

describe('mock charity oracle', () => {
  it('questionnaire: funds the thing you hate most, and says why', async () => {
    const answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, 2]));
    answers.mondays = -2;
    const steps: string[] = [];
    const pick = await oracle.pickCharity({ kind: 'questionnaire', answers, completedAt: '' }, (s) => steps.push(s));
    expect(pick.charity.name).toBe('Friends of Mondays');
    expect(pick.basis).toBe('questionnaire');
    expect(pick.reasons[0]).toContain('Mondays');
    expect(steps).toEqual(['fetching', 'analyzing', 'matching']);
  });

  it('X: always picks a known cause and cites the account', async () => {
    const pick = await oracle.pickCharity({ kind: 'x', account: { handle: 'emmy', connectedAt: '' } });
    expect(Object.values(MOCK_CAUSES).map((c) => c.charity.id)).toContain(pick.charity.id);
    expect(pick.reasons[0]).toContain('@emmy');
  });

  it('X: the same account on the same day gets the same analysis', async () => {
    const source = { kind: 'x' as const, account: { handle: 'emmy', connectedAt: '' } };
    const [a, b] = await Promise.all([oracle.pickCharity(source), oracle.pickCharity(source)]);
    expect(a.charity.id).toBe(b.charity.id);
  });
});
