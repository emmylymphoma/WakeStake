import { describe, expect, it } from 'vitest';
import { alarmTimeline, describeDays, firstRingTime, formatClock, nextAlarmDate, shiftTime } from './alarm';
import type { AlarmConfig } from './types';

const alarm = (over: Partial<AlarmConfig> = {}): AlarmConfig => ({
  wakeBy: '07:00',
  legalSnoozes: 2,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  label: '',
  ...over,
});

describe('first ring / timeline', () => {
  it('rings early so the legal snoozes end exactly at wake-by', () => {
    expect(firstRingTime(alarm())).toBe('06:50');
    expect(firstRingTime(alarm({ legalSnoozes: 0 }))).toBe('07:00');
    expect(firstRingTime(alarm({ wakeBy: '00:05', legalSnoozes: 3 }))).toBe('23:50');
  });

  it('lays out the morning', () => {
    expect(alarmTimeline(alarm())).toEqual([
      { time: '06:50', kind: 'legal' },
      { time: '06:55', kind: 'last-legal' },
      { time: '07:00', kind: 'wake-by' },
      { time: '07:05', kind: 'paid' },
      { time: '07:10', kind: 'paid' },
    ]);
  });

  it('shifts times across midnight', () => {
    expect(shiftTime('23:58', 5)).toBe('00:03');
    expect(shiftTime('00:02', -5)).toBe('23:57');
  });
});

describe('nextAlarmDate', () => {
  // Saturday 26 Sep 2026, 08:00 local
  const now = new Date(2026, 8, 26, 8, 0);

  it('skips to the next matching weekday, at the first-ring time', () => {
    const next = nextAlarmDate(alarm({ days: ['mon'] }), now);
    expect(next?.getDay()).toBe(1);
    expect(next?.getDate()).toBe(28);
    expect([next?.getHours(), next?.getMinutes()]).toEqual([6, 50]);
  });

  it('uses today if the first ring is still ahead', () => {
    expect(nextAlarmDate(alarm({ wakeBy: '09:30', days: ['sat'] }), now)?.getDate()).toBe(26);
  });

  it('wraps a full week when today’s ring has passed', () => {
    expect(nextAlarmDate(alarm({ days: ['sat'] }), now)?.getDate()).toBe(3);
  });

  it('returns null with no days', () => {
    expect(nextAlarmDate(alarm({ days: [] }), now)).toBeNull();
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
