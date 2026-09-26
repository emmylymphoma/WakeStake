import type { AlarmConfig, Weekday } from './types';

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** JS getDay() index (0 = Sunday) → Weekday. */
const BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function parseTime(time: string): { hours: number; minutes: number } {
  const [h = '0', m = '0'] = time.split(':');
  return { hours: Number(h), minutes: Number(m) };
}

/** Next time the alarm fires strictly after `now`, or null if no days are selected. */
export function nextAlarmDate(alarm: AlarmConfig, now: Date): Date | null {
  if (alarm.days.length === 0) return null;
  const { hours, minutes } = parseTime(alarm.time);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    const day = BY_JS_DAY[candidate.getDay()];
    if (day && alarm.days.includes(day) && candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
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
  if (set.size === 0) return 'Never (coward)';
  const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has('sat') && set.has('sun')) return 'Weekends';
  return WEEKDAYS.filter((d) => set.has(d))
    .map((d) => d[0]!.toUpperCase() + d.slice(1))
    .join(', ');
}
