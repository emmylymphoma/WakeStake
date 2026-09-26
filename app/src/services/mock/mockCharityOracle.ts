import { hashSeed, pickGrudge, QUESTIONS, type Grudge } from '../../domain/questionnaire';
import type { BeneficiarySource, Charity, QuestionnaireAnswers, Stance } from '../../domain/types';
import type { CharityOracleService } from '../types';
import { delay } from './util';

/** Every cause the oracle can pick: both sides' champions of every question. */
export const MOCK_CHARITIES: Charity[] = QUESTIONS.flatMap((q) => [q.a.champion, q.b.champion]);

/** Stand-in for "read recent posts/likes/follows and work out where they stand" (real: X API + LLM). */
function fakeXStances(handle: string, day: string): QuestionnaireAnswers {
  const stances: Stance[] = ['a', 'b', 'meh'];
  return Object.fromEntries(QUESTIONS.map((q, i) => [q.id, stances[hashSeed(`${handle}:${day}:${i}`) % 3]!]));
}

function reasonsFor(source: BeneficiarySource, grudge: Grudge): string[] {
  const { question, yours, theirs } = grudge;
  if (source.kind === 'x') {
    return [`Read @${source.account.handle}’s latest 200 posts, likes and follows`, yours.xEvidence];
  }
  return [`You said “${yours.label}” on “${question.prompt}”`, `So team “${theirs.label}” gets your money. Enjoy.`];
}

export function createMockCharityOracleService(latencyMs: number): CharityOracleService {
  return {
    async pickCharity(source: BeneficiarySource, onProgress) {
      const now = new Date();
      const day = now.toDateString();
      onProgress?.('fetching');
      await delay(latencyMs);
      onProgress?.('analyzing');
      await delay(latencyMs * 1.5);

      const who = source.kind === 'x' ? source.account.handle : 'questionnaire';
      const stances = source.kind === 'x' ? fakeXStances(source.account.handle, day) : source.answers;
      const grudge = pickGrudge(stances, `${who}:${day}`);

      onProgress?.('matching');
      await delay(latencyMs);

      if (!grudge) {
        // "Don't care" on everything: then you won't mind anything we pick.
        const charity = MOCK_CHARITIES[hashSeed(day) % MOCK_CHARITIES.length]!;
        const reasons = ['You don’t care about anything', 'So you won’t mind funding this. Random pick.'];
        return { charity, basis: source.kind, reasons, analyzedAt: now.toISOString() };
      }
      return {
        charity: grudge.theirs.champion,
        basis: source.kind,
        reasons: reasonsFor(source, grudge),
        analyzedAt: now.toISOString(),
      };
    },
  };
}
