import { describe, expect, it } from 'vitest';
import { checked } from './checked';

describe('checked', () => {
  it('passes a successful result through untouched', () => {
    const result = { data: [1, 2], count: 2, error: null };
    expect(checked(result)).toBe(result);
  });

  it('throws when the query failed, instead of looking like no data', () => {
    expect(() => checked({ data: null, error: { message: 'permission denied', code: '42501' } })).toThrow('permission denied');
  });

  it('keeps the database error code', () => {
    try {
      checked({ data: null, error: { message: 'x', code: '42501' } });
    } catch (err) {
      expect(err.code).toBe('42501');
    }
    expect.assertions(1);
  });
});
