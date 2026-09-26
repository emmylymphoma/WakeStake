import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, Eyebrow } from '../components/ui';
import { QUESTIONS, isComplete, stanceOptions } from '../domain/questionnaire';
import type { QuestionnaireAnswers } from '../domain/types';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

export function QuestionnaireScreen({ mode }: { mode: 'onboarding' | 'manage' }) {
  const { state, dispatch } = useAppState();
  const { back } = useNavigation();
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    state.beneficiary?.kind === 'questionnaire' ? state.beneficiary.answers : {},
  );
  const done = isComplete(answers);
  const answered = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;

  const submit = () => {
    dispatch({
      type: 'SET_BENEFICIARY',
      beneficiary: { kind: 'questionnaire', answers, completedAt: new Date().toISOString() },
    });
    back();
  };

  return (
    <Screen
      onBack={back}
      step={mode === 'onboarding' ? { current: 3, total: 4 } : undefined}
      footer={
        <Button size="lg" disabled={!done} onClick={submit}>
          {done ? 'Lock in my answers' : `${answered}/${QUESTIONS.length} answered`}
        </Button>
      }
    >
      <Eyebrow>The questionnaire</Eyebrow>
      <h2 className="title">Pick a side. We’ll fund the other one.</h2>
      <p className="muted">Snooze late and your money goes to whatever you’re against. “Don’t care” is safe. Probably.</p>

      <div className="stack-md">
        {QUESTIONS.map((q) => (
          <fieldset key={q.id} className="question">
            <legend className="question-title">
              <span aria-hidden>{q.emoji}</span> {q.prompt}
            </legend>
            <div className="question-scale" role="radiogroup" aria-label={q.prompt}>
              {stanceOptions(q).map((o) => (
                <button
                  key={o.stance}
                  type="button"
                  role="radio"
                  aria-checked={answers[q.id] === o.stance}
                  className={`chip ${answers[q.id] === o.stance ? 'chip-on' : ''} ${o.stance === 'meh' ? 'chip-meh' : ''}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.stance }))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Screen>
  );
}
