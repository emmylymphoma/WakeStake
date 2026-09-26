import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, Eyebrow } from '../components/ui';
import { QUESTIONS, SCALE, isComplete } from '../domain/questionnaire';
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
          {done ? 'Lock in my answers' : `${Object.keys(answers).length}/${QUESTIONS.length} answered`}
        </Button>
      }
    >
      <Eyebrow>The questionnaire</Eyebrow>
      <h2 className="title">Be honest. We’ll use it against you.</h2>

      <div className="stack-md">
        {QUESTIONS.map((q) => (
          <fieldset key={q.id} className="question">
            <legend className="question-title">
              <span aria-hidden>{q.emoji}</span> {q.statement}
            </legend>
            <div className="question-scale" role="radiogroup" aria-label={q.statement}>
              {SCALE.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={answers[q.id] === s.value}
                  className={`chip ${answers[q.id] === s.value ? 'chip-on' : ''}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: s.value }))}
                >
                  <span aria-hidden>{s.emoji}</span>
                  <span className="chip-hint">{s.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Screen>
  );
}
