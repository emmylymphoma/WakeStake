import type { AlarmConfig, Weekday } from './types';

/** Every snooze is exactly this long. Not configurable — that's the point. */
export const SNOOZE_MINUTES = 5;

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** JS getDay() index (0 = Sunday) → Weekday. */
const BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function parseTime(time: string): { hours: number; minutes: number } {
  const [h = '0', m = '0'] = time.split(':');
  return { hours: Number(h), minutes: Number(m) };
}

/** "HH:MM" shifted by `deltaMinutes`, wrapping around midnight. */
export function shiftTime(time: string, deltaMinutes: number): string {
  const { hours, minutes } = parseTime(time);
  const total = (((hours * 60 + minutes + deltaMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** When the alarm first rings: early enough that all legal snoozes end exactly at `wakeBy`. */
export function firstRingTime(alarm: AlarmConfig): string {
  return shiftTime(alarm.wakeBy, -alarm.legalSnoozes * SNOOZE_MINUTES);
}

export type TimelineEntry = { time: string; kind: 'legal' | 'last-legal' | 'wake-by' | 'paid' };

/** Every ring of a morning: legal ones, the must-be-up ring, then a few paid ones. */
export function alarmTimeline(alarm: AlarmConfig, paidRings = 2): TimelineEntry[] {
  const first = firstRingTime(alarm);
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < alarm.legalSnoozes; i++) {
    entries.push({ time: shiftTime(first, i * SNOOZE_MINUTES), kind: i === alarm.legalSnoozes - 1 ? 'last-legal' : 'legal' });
  }
  entries.push({ time: alarm.wakeBy, kind: 'wake-by' });
  for (let i = 1; i <= paidRings; i++) entries.push({ time: shiftTime(alarm.wakeBy, i * SNOOZE_MINUTES), kind: 'paid' });
  return entries;
}

/** Next `time` on one of `days`, strictly after `after`. */
function nextOccurrence(time: string, days: Weekday[], after: Date): Date | null {
  if (days.length === 0) return null;
  const { hours, minutes } = parseTime(time);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(after);
    candidate.setDate(after.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    const day = BY_JS_DAY[candidate.getDay()];
    if (day && days.includes(day) && candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}

/** Next first-ring strictly after `now`, or null if no days are selected. */
export function nextAlarmDate(alarm: AlarmConfig, now: Date): Date | null {
  return nextOccurrence(firstRingTime(alarm), alarm.days, now);
}

/** Next must-be-up moment strictly after `after`. This is the deadline an on-chain stake commits to. */
export function nextDeadline(alarm: AlarmConfig, after: Date): Date | null {
  return nextOccurrence(alarm.wakeBy, alarm.days, after);
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatClock(time: string): string {
  const { hours, minutes } = parseTime(time);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function describeDays(days: Weekday[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 0) return 'Never';
  const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has('sat') && set.has('sun')) return 'Weekends';
  return WEEKDAYS.filter((d) => set.has(d))
    .map((d) => d[0]!.toUpperCase() + d.slice(1))
    .join(', ');
}
