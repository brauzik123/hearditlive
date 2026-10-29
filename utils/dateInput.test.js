import { describe, expect, it } from 'vitest';
import { datePlaceholder, formatDateInput, maskDateInput, parseDateInput } from './dateInput';

describe('date input', () => {
  it('shows dd-mm-yyyy by default, and the order picked in Settings otherwise', () => {
    expect(formatDateInput('2026-10-21', 'long')).toBe('21-10-2026');
    expect(formatDateInput('2026-10-21', 'dmy')).toBe('21-10-2026');
    expect(formatDateInput('2026-10-21', 'mdy')).toBe('10/21/2026');
    expect(formatDateInput('2026-10-21', 'iso')).toBe('2026-10-21');
    expect(formatDateInput('', 'dmy')).toBe('');
  });

  it('puts the dashes in as you type', () => {
    expect(maskDateInput('2', 'dmy')).toBe('2');
    expect(maskDateInput('211', 'dmy')).toBe('21-1');
    expect(maskDateInput('21102026', 'dmy')).toBe('21-10-2026');
    expect(maskDateInput('21.10.2026', 'dmy')).toBe('21-10-2026');
    expect(maskDateInput('211020261999', 'dmy')).toBe('21-10-2026');
    expect(maskDateInput('10212026', 'mdy')).toBe('10/21/2026');
  });

  it('reads complete, real dates only', () => {
    expect(parseDateInput('21-10-2026', 'dmy')).toBe('2026-10-21');
    expect(parseDateInput('10/21/2026', 'mdy')).toBe('2026-10-21');
    expect(parseDateInput('2026-10-21', 'iso')).toBe('2026-10-21');
    expect(parseDateInput('21-10-20', 'dmy')).toBeNull();
    expect(parseDateInput('31-02-2026', 'dmy')).toBeNull();
    expect(parseDateInput('29-02-2024', 'dmy')).toBe('2024-02-29');
    expect(parseDateInput('', 'dmy')).toBeNull();
  });

  it('round-trips', () => {
    for (const fmt of ['dmy', 'mdy', 'iso', 'long']) {
      expect(parseDateInput(formatDateInput('2019-06-01', fmt), fmt)).toBe('2019-06-01');
    }
  });

  it('labels the placeholder in the app language', () => {
    expect(datePlaceholder('dmy', 'en')).toBe('dd-mm-yyyy');
    expect(datePlaceholder('long', 'pl')).toBe('dd-mm-rrrr');
    expect(datePlaceholder('mdy', 'en')).toBe('mm/dd/yyyy');
  });
});
