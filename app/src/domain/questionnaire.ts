import type { QuestionnaireAnswers } from './types';

/**
 * The fallback for users without X: rate a few things, and WakeStake funds whatever you rate lowest.
 * Kept deliberately light-hearted for the prototype — see README for the real-world caveats.
 */
export interface Question {
  id: string;
  statement: string;
  emoji: string;
}

export const QUESTIONS: Question[] = [
  { id: 'pineapple', statement: 'Pineapple on pizza', emoji: '🍍' },
  { id: 'mondays', statement: 'Mondays', emoji: '📅' },
  { id: 'cats', statement: 'Cats', emoji: '🐈' },
  { id: 'dogs', statement: 'Dogs', emoji: '🐕' },
  { id: 'crypto', statement: 'Crypto bros', emoji: '₿' },
  { id: 'mornings', statement: 'Early mornings', emoji: '🌅' },
];

export const SCALE = [
  { value: -2, label: 'Hate it', emoji: '🤬' },
  { value: -1, label: 'Nah', emoji: '👎' },
  { value: 1, label: 'Fine', emoji: '👍' },
  { value: 2, label: 'Love it', emoji: '😍' },
] as const;

export function scaleLabel(score: number): string {
  return SCALE.find((s) => s.value === score)?.label ?? 'Meh';
}

export function isComplete(answers: QuestionnaireAnswers): boolean {
  return QUESTIONS.every((q) => typeof answers[q.id] === 'number');
}

/** The thing you like least. Ties go to the earliest question, so the result is stable. */
export function mostHated(scores: QuestionnaireAnswers): Question {
  let worst = QUESTIONS[0]!;
  for (const q of QUESTIONS) {
    if ((scores[q.id] ?? 0) < (scores[worst.id] ?? 0)) worst = q;
  }
  return worst;
}
