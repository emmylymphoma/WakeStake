import { describe, expect, it } from 'vitest';
import { isComplete, mostHated, QUESTIONS } from './questionnaire';

const all = (score: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, score]));

describe('mostHated', () => {
  it('picks the lowest-rated statement', () => {
    expect(mostHated({ ...all(2), mondays: -2 }).id).toBe('mondays');
    expect(mostHated({ ...all(1), cats: -1, dogs: -2 }).id).toBe('dogs');
  });

  it('breaks ties by question order', () => {
    expect(mostHated({ ...all(1), crypto: -2, mondays: -2 }).id).toBe('mondays');
  });

  it('still picks something if you love everything', () => {
    expect(mostHated({ ...all(2), mornings: 1 }).id).toBe('mornings');
  });
});

describe('isComplete', () => {
  it('requires every question', () => {
    expect(isComplete(all(1))).toBe(true);
    const { cats: _cats, ...missing } = all(1);
    expect(isComplete(missing)).toBe(false);
  });
});
