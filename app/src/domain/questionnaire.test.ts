import { describe, expect, it } from 'vitest';
import type { QuestionnaireAnswers, Stance } from './types';
import { grudges, isComplete, pickGrudge, QUESTIONS, stanceOptions } from './questionnaire';

const all = (stance: Stance): QuestionnaireAnswers => Object.fromEntries(QUESTIONS.map((q) => [q.id, stance]));

describe('grudges', () => {
  it('funds the champion of the side you’re against', () => {
    const [grudge] = grudges({ ...all('meh'), vegans: 'b' });
    expect(grudge?.yours.label).toBe('No');
    expect(grudge?.theirs.champion.name).toBe('PETA');
  });

  it('works both ways', () => {
    expect(grudges({ ...all('meh'), abortion: 'a' })[0]?.theirs.champion.name).toBe('National Right to Life');
    expect(grudges({ ...all('meh'), abortion: 'b' })[0]?.theirs.champion.name).toBe('Planned Parenthood');
  });

  it('ignores “don’t care”', () => {
    expect(grudges(all('meh'))).toEqual([]);
  });
});

describe('pickGrudge', () => {
  it('is stable for the same seed and always one of your grudges', () => {
    const answers = { ...all('meh'), guns: 'a', god: 'b', ukraine: 'b' } as QuestionnaireAnswers;
    const pick = pickGrudge(answers, 'Mon Sep 28 2026');
    expect(pick).toEqual(pickGrudge(answers, 'Mon Sep 28 2026'));
    expect(['guns', 'god', 'ukraine']).toContain(pick?.question.id);
  });

  it('is null if you don’t care about anything', () => {
    expect(pickGrudge(all('meh'), 'x')).toBeNull();
  });
});

describe('questions', () => {
  it('always offers exactly side A, side B, or don’t care, with short labels', () => {
    for (const q of QUESTIONS) {
      const options = stanceOptions(q);
      expect(options.map((o) => o.stance)).toEqual(['a', 'b', 'meh']);
      for (const o of options) expect(o.label.length).toBeLessThanOrEqual(20);
    }
  });

  it('has unique ids and unique champions', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    const champions = QUESTIONS.flatMap((q) => [q.a.champion.id, q.b.champion.id]);
    expect(new Set(champions).size).toBe(champions.length);
  });
});

describe('isComplete', () => {
  it('requires every question, “don’t care” counts', () => {
    expect(isComplete(all('meh'))).toBe(true);
    const { guns: _guns, ...missing } = all('a');
    expect(isComplete(missing)).toBe(false);
  });
});
