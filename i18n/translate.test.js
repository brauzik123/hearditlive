import { describe, expect, it, vi } from 'vitest';
import { formatDate, makeT, stubDate } from './translate';

describe('makeT', () => {
  const pl = makeT(
    {
      shows: { one: '{count} koncert', few: '{count} koncerty', many: '{count} koncertów', other: '{count} koncertu' },
      hello: 'Cześć, {name}!',
    },
    'pl'
  );

  it('picks the right Polish plural form', () => {
    expect(pl('shows', { count: 1 })).toBe('1 koncert');
    expect(pl('shows', { count: 3 })).toBe('3 koncerty');
    expect(pl('shows', { count: 5 })).toBe('5 koncertów');
    expect(pl('shows', { count: 22 })).toBe('22 koncerty');
    expect(pl('shows', { count: 12 })).toBe('12 koncertów');
  });

  it('fills in placeholders', () => {
    expect(pl('hello', { name: 'Ola' })).toBe('Cześć, Ola!');
  });

  it('shows the key itself when a translation is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pl('nope.missing')).toBe('nope.missing');
    warn.mockRestore();
  });
});

describe('dates', () => {
  it('formats a date in each preferred format', () => {
    expect(formatDate('2026-03-07', 'en', null, 'dmy')).toBe('07.03.2026');
    expect(formatDate('2026-03-07', 'en', null, 'mdy')).toBe('03/07/2026');
    expect(formatDate('2026-03-07', 'en', null, 'iso')).toBe('2026-03-07');
    expect(formatDate('', 'en')).toBe('');
  });

  it('never shifts a date to the neighbouring day', () => {
    expect(formatDate('2026-01-01', 'en', null, 'iso')).toBe('2026-01-01');
    expect(stubDate('2026-12-31', 'en', 'dmy')).toEqual({ big: '31.12', small: '2026' });
  });

  it('builds a ticket stub with the month spelled out', () => {
    expect(stubDate('2026-03-07', 'en')).toEqual({ big: '7', middle: 'Mar', small: '2026' });
  });
});
