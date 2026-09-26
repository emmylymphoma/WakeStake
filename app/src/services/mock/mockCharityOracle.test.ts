import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../../domain/questionnaire';
import type { QuestionnaireAnswers } from '../../domain/types';
import { createMockCharityOracleService, MOCK_CHARITIES } from './mockCharityOracle';

const oracle = createMockCharityOracleService(0);
const dontCare = (): QuestionnaireAnswers => Object.fromEntries(QUESTIONS.map((q) => [q.id, 'meh']));

describe('mock charity oracle', () => {
  it('questionnaire: funds the other side, and says why', async () => {
    const answers = { ...dontCare(), vegans: 'b' } as QuestionnaireAnswers;
    const steps: string[] = [];
    const pick = await oracle.pickCharity({ kind: 'questionnaire', answers, completedAt: '' }, (s) => steps.push(s));
    expect(pick.charity.name).toBe('PETA');
    expect(pick.basis).toBe('questionnaire');
    expect(pick.reasons[0]).toBe('You said “No” on “Do you like vegans?”');
    expect(steps).toEqual(['fetching', 'analyzing', 'matching']);
  });

  it('questionnaire: not caring about anything still costs you', async () => {
    const pick = await oracle.pickCharity({ kind: 'questionnaire', answers: dontCare(), completedAt: '' });
    expect(MOCK_CHARITIES.map((c) => c.id)).toContain(pick.charity.id);
    expect(pick.reasons[0]).toBe('You don’t care about anything');
  });

  it('X: always picks a known cause and cites the account', async () => {
    const pick = await oracle.pickCharity({ kind: 'x', account: { handle: 'emmy', connectedAt: '' } });
    expect(MOCK_CHARITIES.map((c) => c.id)).toContain(pick.charity.id);
    expect(pick.reasons[0]).toContain('@emmy');
  });

  it('X: the same account on the same day gets the same analysis', async () => {
    const source = { kind: 'x' as const, account: { handle: 'emmy', connectedAt: '' } };
    const [a, b] = await Promise.all([oracle.pickCharity(source), oracle.pickCharity(source)]);
    expect(a.charity.id).toBe(b.charity.id);
  });
});
