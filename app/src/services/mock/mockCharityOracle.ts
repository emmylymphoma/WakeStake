import { mostHated, QUESTIONS, scaleLabel } from '../../domain/questionnaire';
import type { BeneficiarySource, Charity, QuestionnaireAnswers } from '../../domain/types';
import type { CharityOracleService } from '../types';
import { delay } from './util';

/**
 * Fictional causes, one per questionnaire statement: the charity that champions it.
 * The real registry would hold vetted, registered charities that can receive the payout.
 */
export const MOCK_CAUSES: Record<string, { charity: Charity; xEvidence: string }> = {
  pineapple: {
    charity: { id: 'hawaiian-pizza', name: 'Hawaiian Pizza Defense Fund', tagline: 'Fighting for fruit on pizza, worldwide.', emoji: '🍍', category: 'Food' },
    xEvidence: 'Called pineapple on pizza “a war crime” in 3 recent posts',
  },
  mondays: {
    charity: { id: 'friends-of-mondays', name: 'Friends of Mondays', tagline: 'Rebranding Monday as the best day of the week.', emoji: '📅', category: 'Culture' },
    xEvidence: 'Your posts mentioning Mondays are 94% negative',
  },
  cats: {
    charity: { id: 'cat-cafe-trust', name: 'Cat Café Expansion Trust', tagline: 'A cat café on every street corner.', emoji: '🐈', category: 'Animals' },
    xEvidence: 'Liked 11 posts calling cats “tiny landlords”',
  },
  dogs: {
    charity: { id: 'good-boy-network', name: 'Good Boy Rescue Network', tagline: 'More dogs. Everywhere. Always.', emoji: '🐕', category: 'Animals' },
    xEvidence: 'Muted 3 accounts that only post dogs',
  },
  crypto: {
    charity: { id: 'laser-eyes', name: 'Laser Eyes Education Fund', tagline: 'Teaching everyone to never sell.', emoji: '₿', category: 'Finance' },
    xEvidence: 'Quote-posted a crypto bro with “🤡” twice this week',
  },
  mornings: {
    charity: { id: 'early-risers', name: 'Early Risers Society', tagline: 'Promoting 5 a.m. workouts and cold showers.', emoji: '🌅', category: 'Lifestyle' },
    xEvidence: 'Posted “why is it morning again” 6 times this month',
  },
};

/** Cheap deterministic hash so the same handle on the same day gets the same "analysis". */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Stand-in for "read recent posts/likes/follows and score each cause" (real: X API + LLM). */
function fakeXScores(handle: string, day: string): QuestionnaireAnswers {
  const scores: QuestionnaireAnswers = {};
  QUESTIONS.forEach((q, i) => {
    scores[q.id] = [-2, -1, 1, 2][hash(`${handle}:${day}:${i}`) % 4]!;
  });
  return scores;
}

export function createMockCharityOracleService(latencyMs: number): CharityOracleService {
  return {
    async pickCharity(source: BeneficiarySource, onProgress) {
      const now = new Date();
      onProgress?.('fetching');
      await delay(latencyMs);
      onProgress?.('analyzing');
      await delay(latencyMs * 1.5);

      const scores = source.kind === 'x' ? fakeXScores(source.account.handle, now.toDateString()) : source.answers;
      const worst = mostHated(scores);
      const cause = MOCK_CAUSES[worst.id]!;

      onProgress?.('matching');
      await delay(latencyMs);

      const reasons =
        source.kind === 'x'
          ? [`Read @${source.account.handle}’s latest 200 posts, likes and follows`, cause.xEvidence]
          : [`You rated “${worst.statement}”: ${scaleLabel(source.answers[worst.id] ?? 0)}`, 'Lowest score in your questionnaire'];

      return { charity: cause.charity, basis: source.kind, reasons, analyzedAt: now.toISOString() };
    },
  };
}
