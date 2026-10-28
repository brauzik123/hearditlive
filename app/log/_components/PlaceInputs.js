import { useEffect, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { createClient } from '../../../utils/supabase/client';
import { cityName } from '../../../utils/placeNames';
import { exact } from '../_lib/entryForm';
import { Suggestions } from './fields';

// City with GeoNames suggestions. Picking one links the city to its
// GeoNames id, so the same city always counts once whatever it's called.
export function CityInput({ form, update }) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const query = form.city.trim();

  useEffect(() => {
    if (!focused || form.cityGeonameId || query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/search?${new URLSearchParams({ q: query, lang: locale })}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.cities ?? []);
      } catch {
        // Aborted or offline: keep the field as plain text.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused, form.cityGeonameId, locale]);

  const visible = focused && !form.cityGeonameId && query.length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        <MapPin size={14} /> {t('log.city')}
      </span>
      <div className="relative">
        <input
          className="field"
          placeholder={t('log.cityPlaceholder')}
          value={form.city}
          aria-label={t('log.city')}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => update({ city: e.target.value, cityGeonameId: null })}
        />
        <Suggestions
          items={visible}
          onPick={(city) => {
            update({ city: city.name, cityGeonameId: city.geonameId });
            setFocused(false);
          }}
          render={(city) => (
            <>
              <span className="font-medium">{city.name}</span>
              <span className="text-muted">{[city.region, city.country].filter(Boolean).map((p) => `, ${p}`).join('')}</span>
            </>
          )}
        />
      </div>
      {form.cityGeonameId ? (
        <span className="flex items-center gap-1 text-xs text-brand">
          <Check size={12} /> {t('log.cityLinked')}
        </span>
      ) : (
        query.length >= 2 && !focused && <span className="text-xs text-muted">{t('log.cityUnlinked')}</span>
      )}
    </div>
  );
}

// Venue with suggestions from venues already in the app (in the chosen
// city when there is one), so "Progresja" isn't saved three ways.
export function VenueInput({ form, update }) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const query = form.venue.trim();

  useEffect(() => {
    if (!focused || query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let request = createClient()
        .from('venues')
        .select('name, city, city_id, cities(name_en, name_pl)')
        .ilike('name', `%${exact(query)}%`)
        .limit(6);
      if (form.cityGeonameId) request = request.eq('city_id', form.cityGeonameId);
      const { data } = await request;
      if (!cancelled) setResults(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, focused, form.cityGeonameId]);

  // Hide the suggestion that's exactly what's typed already.
  const visible = focused
    ? results.filter((v) => !(v.name.toLowerCase() === query.toLowerCase() && (!form.cityGeonameId || v.city_id === form.cityGeonameId)))
    : [];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        <MapPin size={14} /> {t('log.venue')}
      </span>
      <div className="relative">
        <input
          className="field"
          placeholder={t('log.venuePlaceholder')}
          value={form.venue}
          aria-label={t('log.venue')}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // A hand-edited venue is no longer the imported setlist.fm one.
          onChange={(e) => update({ venue: e.target.value, setlistfmVenueId: null })}
        />
        <Suggestions
          items={visible}
          onPick={(venue) => {
            update({
              venue: venue.name,
              setlistfmVenueId: null,
              ...(venue.city_id && !form.cityGeonameId
                ? { city: cityName(venue, locale), cityGeonameId: venue.city_id }
                : {}),
            });
            setFocused(false);
          }}
          render={(venue) => (
            <>
              <span className="font-medium">{venue.name}</span>
              {cityName(venue, locale) && <span className="text-muted">, {cityName(venue, locale)}</span>}
            </>
          )}
        />
      </div>
    </div>
  );
}
