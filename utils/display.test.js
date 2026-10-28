import { describe, expect, it } from 'vitest';
import { cityName } from './placeNames';
import { formatRating } from './rating';

describe('cityName', () => {
  const warsaw = { city: 'Warszawa', cities: { name_en: 'Warsaw', name_pl: 'Warszawa' } };

  it('uses the linked city in the viewer’s language', () => {
    expect(cityName(warsaw, 'en')).toBe('Warsaw');
    expect(cityName(warsaw, 'pl')).toBe('Warszawa');
  });

  it('falls back to English, then to the saved text', () => {
    expect(cityName({ city: 'x', cities: { name_en: 'Gdynia', name_pl: null } }, 'pl')).toBe('Gdynia');
    expect(cityName({ city: 'Somewhere', cities: null }, 'en')).toBe('Somewhere');
    expect(cityName(null, 'en')).toBe('');
  });
});

describe('formatRating', () => {
  it('uses the app language’s decimal separator', () => {
    expect(formatRating(7.5, 'en')).toBe('7.5');
    expect(formatRating(7.5, 'pl')).toBe('7,5');
  });

  it('drops a trailing zero from database values', () => {
    expect(formatRating('8.0', 'en')).toBe('8');
  });
});
