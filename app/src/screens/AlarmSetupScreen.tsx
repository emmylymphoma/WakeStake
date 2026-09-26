import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, ChipGroup, Eyebrow, Field } from '../components/ui';
import { SNOOZE_MINUTES, WEEKDAYS, alarmTimeline, describeDays, formatClock } from '../domain/alarm';
import type { AlarmConfig, Weekday } from '../domain/types';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

const LEGAL_SNOOZES = [
  { value: 0, label: '0', hint: 'Hardcore' },
  { value: 1, label: '1', hint: 'Strict' },
  { value: 2, label: '2', hint: 'Human' },
  { value: 3, label: '3', hint: 'Soft' },
];

const TIMELINE_LABEL = {
  legal: 'Alarm · snooze free',
  'last-legal': 'Last legal snooze ⚠',
  'wake-by': 'Be up. Snoozing now costs money',
  paid: 'Still in bed? Paying.',
} as const;

export function AlarmSetupScreen() {
  const { state, dispatch } = useAppState();
  const { navigate, back } = useNavigation();
  const [wakeBy, setWakeBy] = useState(state.alarm.wakeBy);
  const [legalSnoozes, setLegalSnoozes] = useState(state.alarm.legalSnoozes);
  const [days, setDays] = useState<Weekday[]>(state.alarm.days);
  const [label, setLabel] = useState(state.alarm.label);

  const alarm: AlarmConfig = { wakeBy, legalSnoozes, days, label: label.trim() || 'Wake up' };
  const timeline = wakeBy ? alarmTimeline(alarm) : [];

  const toggleDay = (d: Weekday) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || cur.includes(x))));

  const save = () => {
    dispatch({ type: 'SET_ALARM', alarm });
    navigate({ name: 'beneficiary', mode: 'onboarding' });
  };

  return (
    <Screen
      onBack={back}
      step={{ current: 2, total: 4 }}
      footer={
        <Button size="lg" disabled={days.length === 0 || !wakeBy} onClick={save}>
          Arm the alarm
        </Button>
      }
    >
      <Eyebrow>Step 2 · The alarm</Eyebrow>
      <h2 className="title">What time do you actually need to be up?</h2>

      <label className="time-picker">
        <span className="sr-only">Must be up by</span>
        <input type="time" value={wakeBy} onChange={(e) => setWakeBy(e.target.value)} />
        <span className="time-picker-hint muted">Out of bed by {wakeBy ? formatClock(wakeBy) : '—'}</span>
      </label>

      <section className="stack-sm">
        <h3 className="section-title">Legal snoozes</h3>
        <ChipGroup label="Legal snoozes" options={LEGAL_SNOOZES} value={legalSnoozes} onChange={setLegalSnoozes} />
        <p className="muted small">
          Snoozes are always {SNOOZE_MINUTES} minutes. Legal snoozes happen <em>before</em> your wake-up time, so the
          alarm starts early. Snooze past {wakeBy ? formatClock(wakeBy) : 'it'} and you pay.
        </p>
      </section>

      {timeline.length > 0 ? (
        <ol className="timeline" aria-label="Your morning">
          {timeline.map((t) => (
            <li key={t.time + t.kind} className={`timeline-row timeline-${t.kind}`}>
              <span className="timeline-time">{formatClock(t.time)}</span>
              <span className="timeline-dot" aria-hidden />
              <span className="timeline-label">{TIMELINE_LABEL[t.kind]}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <section className="stack-sm">
        <h3 className="section-title">
          Repeat <span className="muted small">· {describeDays(days)}</span>
        </h3>
        <div className="day-row">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days.includes(d)}
              className={`day ${days.includes(d) ? 'day-on' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {d[0]!.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <Field label="Alarm label">
        <input className="input" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
      </Field>
    </Screen>
  );
}
