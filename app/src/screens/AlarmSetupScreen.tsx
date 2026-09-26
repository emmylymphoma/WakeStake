import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Button, ChipGroup, Eyebrow, Field } from '../components/ui';
import { WEEKDAYS, describeDays, formatClock } from '../domain/alarm';
import type { Weekday } from '../domain/types';
import { useNavigation } from '../navigation/Navigation';
import { useAppState } from '../state/AppStateContext';

const SNOOZE_OPTIONS = [5, 9, 15].map((m) => ({ value: m, label: `${m} min` }));

export function AlarmSetupScreen() {
  const { state, dispatch } = useAppState();
  const { navigate, back } = useNavigation();
  const [time, setTime] = useState(state.alarm.time);
  const [days, setDays] = useState<Weekday[]>(state.alarm.days);
  const [label, setLabel] = useState(state.alarm.label);
  const [snoozeMinutes, setSnoozeMinutes] = useState(state.alarm.snoozeMinutes);

  const toggleDay = (d: Weekday) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || cur.includes(x))));

  const save = () => {
    dispatch({ type: 'SET_ALARM', alarm: { time, days, label: label.trim() || 'Wake up', snoozeMinutes } });
    navigate({ name: 'charity' });
  };

  return (
    <Screen
      onBack={back}
      step={{ current: 2, total: 4 }}
      footer={
        <Button size="lg" disabled={days.length === 0 || !time} onClick={save}>
          Arm the alarm
        </Button>
      }
    >
      <Eyebrow>Step 2 · The alarm</Eyebrow>
      <h2 className="title">When does the pain start?</h2>

      <label className="time-picker">
        <span className="sr-only">Alarm time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <span className="time-picker-hint muted">{time ? formatClock(time) : '—'}</span>
      </label>

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

      <section className="stack-sm">
        <h3 className="section-title">Snooze length</h3>
        <ChipGroup label="Snooze length" options={SNOOZE_OPTIONS} value={snoozeMinutes} onChange={setSnoozeMinutes} />
      </section>

      <Field label="Alarm label">
        <input className="input" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
      </Field>
    </Screen>
  );
}
