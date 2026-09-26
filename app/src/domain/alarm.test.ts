import { describe, expect, it } from 'vitest';
import { describeDays, formatClock, nextAlarmDate } from './alarm';

describe('nextAlarmDate', () => {
  // Saturday 26 Sep 2026, 08:00 local
  const now = new Date(2026, 8, 26, 8, 0);

  it('skips to the next matching weekday', () => {
    const next = nextAlarmDate({ time: '07:00', days: ['mon'], label: '', snoozeMinutes: 9 }, now);
    expect(next?.getDay()).toBe(1);
    expect(next?.getDate()).toBe(28);
  });

  it('uses today if the time is still ahead', () => {
    const next = nextAlarmDate({ time: '09:30', days: ['sat'], label: '', snoozeMinutes: 9 }, now);
    expect(next?.getDate()).toBe(26);
  });

  it('wraps a full week when today’s time has passed', () => {
    const next = nextAlarmDate({ time: '07:00', days: ['sat'], label: '', snoozeMinutes: 9 }, now);
    expect(next?.getDate()).toBe(3);
  });

  it('returns null with no days', () => {
    expect(nextAlarmDate({ time: '07:00', days: [], label: '', snoozeMinutes: 9 }, now)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats 12h clock', () => {
    expect(formatClock('07:05')).toBe('7:05 AM');
    expect(formatClock('00:00')).toBe('12:00 AM');
    expect(formatClock('13:30')).toBe('1:30 PM');
  });

  it('describes day sets', () => {
    expect(describeDays(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('Weekdays');
    expect(describeDays(['sat', 'sun'])).toBe('Weekends');
    expect(describeDays(['mon', 'wed'])).toBe('Mon, Wed');
  });
});
