import type { Charity, QuestionnaireAnswers, Stance } from './types';

/**
 * The fallback for users without X: pick a side on hot topics, and WakeStake funds the side you're against.
 * Every side has a champion; when you snooze late, your money goes to the champion of the *other* side.
 *
 * Real organisations are named for the joke's sake. The on-chain payout still goes to the one
 * configured donation address; a real registry needs orgs that agreed to (and can) receive it.
 */
export interface Side {
  label: string;
  /** The cause people on this side love. People on the other side end up funding it. */
  champion: Charity;
  /** Fake "we read your X" evidence that you're on this side. */
  xEvidence: string;
}

export interface Question {
  id: string;
  prompt: string;
  emoji: string;
  a: Side;
  b: Side;
}

export const DONT_CARE = 'Don’t care';

const charity = (id: string, name: string, tagline: string, emoji: string, category: string): Charity => ({
  id,
  name,
  tagline,
  emoji,
  category,
});

export const QUESTIONS: Question[] = [
  {
    id: 'abortion',
    prompt: 'Abortion',
    emoji: '🤰',
    a: {
      label: 'Pro-choice',
      champion: charity('planned-parenthood', 'Planned Parenthood', 'Reproductive healthcare, abortion included.', '🩺', 'Abortion'),
      xEvidence: 'Reposted 14 “my body, my choice” threads this month',
    },
    b: {
      label: 'Pro-life',
      champion: charity('nrlc', 'National Right to Life', 'Pro-life lobbying since 1968.', '👶', 'Abortion'),
      xEvidence: 'Your bio has a 🕊️, a flag and a Bible verse',
    },
  },
  {
    id: 'middle-east',
    prompt: 'The Middle East',
    emoji: '🕊️',
    a: {
      label: 'Israel',
      champion: charity('fidf', 'Friends of the IDF', 'Care packages for Israeli soldiers.', '🇮🇱', 'Middle East'),
      xEvidence: 'Liked 31 posts with 🇮🇱 in them. We counted.',
    },
    b: {
      label: 'Palestine',
      champion: charity('pcrf', 'Palestine Children’s Relief Fund', 'Medical care for kids in Gaza and beyond.', '🇵🇸', 'Middle East'),
      xEvidence: 'There’s a 🍉 in your display name',
    },
  },
  {
    id: 'pride',
    prompt: 'Pride month',
    emoji: '🌈',
    a: {
      label: 'LGBTQ+',
      champion: charity('trevor', 'The Trevor Project', 'Crisis support for LGBTQ+ young people.', '🏳️‍🌈', 'LGBTQ+'),
      xEvidence: 'Your profile picture has had a rainbow border since 2019',
    },
    b: {
      label: 'Normal',
      champion: charity('focus-family', 'Focus on the Family', 'Christian ministry for traditional families.', '⛪', 'LGBTQ+'),
      xEvidence: 'Replied “read Leviticus” to 6 brands in June',
    },
  },
  {
    id: 'blm',
    prompt: 'Black Lives Matter',
    emoji: '✊',
    a: {
      label: 'BLM',
      champion: charity('blm', 'Black Lives Matter Global Network Foundation', 'Fighting anti-Black racism.', '✊🏿', 'Race'),
      xEvidence: 'Posted a black square in 2020 and never deleted it',
    },
    b: {
      label: 'Back the Blue',
      champion: charity('nleomf', 'National Law Enforcement Officers Memorial Fund', 'Honouring fallen police officers.', '👮', 'Race'),
      xEvidence: 'Replied “all lives matter” under 8 posts that didn’t ask',
    },
  },
  {
    id: 'ukraine',
    prompt: 'Russia vs Ukraine',
    emoji: '🪖',
    a: {
      label: 'Russia',
      champion: charity('kremlin-choir', 'Kremlin Choir Appreciation Society', 'Patriotic songs, mandatory attendance.', '🇷🇺', 'War'),
      xEvidence: 'Replied “it’s more complicated than that” under 12 Ukraine posts',
    },
    b: {
      label: 'Ukraine',
      champion: charity('come-back-alive', 'Come Back Alive', 'Gear and training for Ukraine’s defenders.', '🇺🇦', 'War'),
      xEvidence: 'There’s been a 🇺🇦 in your name since February 2022',
    },
  },
  {
    id: 'guns',
    prompt: 'Guns',
    emoji: '🔫',
    a: {
      label: '2nd Amendment',
      champion: charity('nra-foundation', 'NRA Foundation', 'Firearms training and 2A education.', '🦅', 'Guns'),
      xEvidence: 'Your header photo is a sunset over a gun safe',
    },
    b: {
      label: 'Ban them',
      champion: charity('everytown', 'Everytown for Gun Safety', 'Stricter gun laws, one state at a time.', '🚫', 'Guns'),
      xEvidence: 'Quote-posted the NRA with 🤡 four times',
    },
  },
  {
    id: 'vegans',
    prompt: 'Do you like vegans?',
    emoji: '🥦',
    a: {
      label: 'Yes',
      champion: charity('peta', 'PETA', 'Animal rights. Extremely loudly.', '🐮', 'Food'),
      xEvidence: 'Asked a restaurant “is this oat milk?” in a public reply',
    },
    b: {
      label: 'No',
      champion: charity('beef-council', 'National Cattlemen’s Beef Association', 'Beef. It’s what’s for dinner.', '🥩', 'Food'),
      xEvidence: 'Posted a steak with the caption “vegans seething”',
    },
  },
  {
    id: 'climate',
    prompt: 'Climate change',
    emoji: '🌍',
    a: {
      label: 'Crisis',
      champion: charity('greenpeace', 'Greenpeace', 'Direct action for the planet.', '🐋', 'Climate'),
      xEvidence: 'Posted “we have 7 years left” three separate years',
    },
    b: {
      label: 'Hoax',
      champion: charity('heartland', 'Heartland Institute', 'Think tank, famously chill about climate.', '🛢️', 'Climate'),
      xEvidence: 'Posted “so much for global warming” during a snowstorm',
    },
  },
  {
    id: 'trump',
    prompt: 'Make America great again?',
    emoji: '🧢',
    a: {
      label: 'Yes',
      champion: charity('heritage', 'Heritage Foundation', 'Conservative think tank. Wrote Project 2025.', '🏛️', 'Politics'),
      xEvidence: 'You own the hat. It’s in 4 of your photos.',
    },
    b: {
      label: 'No',
      champion: charity('aclu', 'ACLU', 'Suing the government since 1920.', '⚖️', 'Politics'),
      xEvidence: 'Your drafts folder is just the word “fascism” 40 times',
    },
  },
  {
    id: 'border',
    prompt: 'Foreigners',
    emoji: '🧱',
    a: {
      label: 'ICE them all',
      champion: charity('fair', 'FAIR', 'Lobbying for less immigration.', '🧱', 'Immigration'),
      xEvidence: 'Reposted an ICE raid video with the 🍿 emoji',
    },
    b: {
      label: 'Open borders',
      champion: charity('raices', 'RAICES', 'Legal help for immigrants and refugees.', '🌎', 'Immigration'),
      xEvidence: '“No human is illegal” is pinned to your profile',
    },
  },
  {
    id: 'god',
    prompt: 'Is God real?',
    emoji: '🙏',
    a: {
      label: 'Yes',
      champion: charity('gideons', 'Gideons International', 'The Bible in your hotel nightstand.', '📖', 'Religion'),
      xEvidence: 'Wrote “He is risen” in 3 unrelated replies',
    },
    b: {
      label: 'No',
      champion: charity('ffrf', 'Freedom From Religion Foundation', 'Keeping church and state separate.', '🔬', 'Religion'),
      xEvidence: 'Got into a debate about the Big Bang under a bakery’s post',
    },
  },
  {
    id: 'vaccines',
    prompt: 'Vaccines',
    emoji: '💉',
    a: {
      label: 'Vaxxed',
      champion: charity('gavi', 'Gavi, the Vaccine Alliance', 'Vaccines for kids worldwide.', '💉', 'Health'),
      xEvidence: 'Posted a vaccine card selfie. With a filter.',
    },
    b: {
      label: 'Did my research',
      champion: charity('chd', 'Children’s Health Defense', 'Vaccine-skeptic advocacy group.', '🧪', 'Health'),
      xEvidence: 'Replied “do your own research” 22 times. Linked no research.',
    },
  },
  {
    id: 'economy',
    prompt: 'The economy',
    emoji: '💰',
    a: {
      label: 'Capitalism',
      champion: charity('ayn-rand', 'Ayn Rand Institute', 'Selfishness, but make it a philosophy.', '🗽', 'Economy'),
      xEvidence: 'Posted “taxation is theft” from your parents’ Wi-Fi',
    },
    b: {
      label: 'Socialism',
      champion: charity('dsa', 'Democratic Socialists of America', 'Seize the means of production.', '🌹', 'Economy'),
      xEvidence: 'Posted “eat the rich” from your iPhone 16 Pro',
    },
  },
  {
    id: 'feminism',
    prompt: 'Feminism',
    emoji: '👠',
    a: {
      label: 'Feminist',
      champion: charity('feminist-majority', 'Feminist Majority Foundation', 'Equality for women, loudly.', '♀️', 'Gender'),
      xEvidence: 'Replied “men ☕” to a man’s post about coffee',
    },
    b: {
      label: 'Back to the kitchen',
      champion: charity('cwa', 'Concerned Women for America', 'Conservative Christian women’s lobby.', '🥧', 'Gender'),
      xEvidence: 'Posted a sourdough starter with the caption “my career”',
    },
  },
];

export function isComplete(answers: QuestionnaireAnswers): boolean {
  return QUESTIONS.every((q) => answers[q.id] !== undefined);
}

export interface Grudge {
  question: Question;
  /** The side you took. */
  yours: Side;
  /** The side you're against: its champion gets your money. */
  theirs: Side;
}

/** Every topic you took a side on. */
export function grudges(answers: QuestionnaireAnswers): Grudge[] {
  return QUESTIONS.flatMap((question) => {
    const stance = answers[question.id];
    if (stance === 'a') return [{ question, yours: question.a, theirs: question.b }];
    if (stance === 'b') return [{ question, yours: question.b, theirs: question.a }];
    return [];
  });
}

/** Cheap deterministic hash, so the same seed always picks the same grudge. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * One grudge to fund today. `seed` changes daily, so each morning can hit a different nerve.
 * Null if you don't care about anything.
 */
export function pickGrudge(answers: QuestionnaireAnswers, seed: string): Grudge | null {
  const all = grudges(answers);
  return all[hashSeed(seed) % all.length] ?? null;
}

/** Stance labels for a question, in display order. */
export function stanceOptions(q: Question): { stance: Stance; label: string }[] {
  return [
    { stance: 'a', label: q.a.label },
    { stance: 'b', label: q.b.label },
    { stance: 'meh', label: DONT_CARE },
  ];
}
