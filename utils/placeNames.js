// A venue's city in the viewer's language: the linked GeoNames city when
// there is one ("Warszawa" in Polish, "Warsaw" in English), otherwise the
// free text it was saved with. Expects venues(city, cities(name_en, name_pl)).
export function cityName(venue, locale) {
  const city = venue?.cities;
  return (locale === 'pl' ? city?.name_pl : null) ?? city?.name_en ?? venue?.city ?? '';
}

// Supabase select fragment for a venue with its localized city names.
export const VENUE_FIELDS = 'venues(name, city, city_id, cities(name_en, name_pl))';
