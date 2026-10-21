import 'server-only';

// GeoNames (geonames.org): the shared id space for cities. setlist.fm
// reports cities with these same ids, so imported and typed cities match.
// Free tier: 1000 requests/hour; each city is fetched once and then kept in
// our `cities` table.
const GEONAMES = 'http://api.geonames.org';

async function geonames(path, params) {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) throw new Error('GEONAMES_USERNAME is not set.');
  const res = await fetch(`${GEONAMES}/${path}?${new URLSearchParams({ ...params, username })}`);
  if (!res.ok) throw new Error(`GeoNames error ${res.status}`);
  const data = await res.json();
  // GeoNames reports errors (bad account, limit hit) as 200 + status object.
  if (data.status) throw new Error(`GeoNames: ${data.status.message}`);
  return data;
}

function preferredName(alternateNames, lang) {
  const names = (alternateNames ?? []).filter((n) => n.lang === lang);
  return (names.find((n) => n.isPreferredName) ?? names.find((n) => !n.isShortName) ?? names[0])?.name ?? null;
}

// Cities whose name starts with `query`, biggest first, named in `lang`.
const searchCache = new Map();
export async function searchCities(query, lang) {
  const key = `${lang}:${query.toLowerCase()}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const data = await geonames('searchJSON', {
    name_startsWith: query,
    featureClass: 'P',
    orderby: 'population',
    maxRows: '8',
    lang,
  });
  const results = (data.geonames ?? []).map((g) => ({
    geonameId: Number(g.geonameId),
    name: g.name,
    region: g.adminName1 || null,
    country: g.countryName || null,
  }));
  if (searchCache.size > 500) searchCache.clear();
  searchCache.set(key, results);
  return results;
}

// Best match for a free-text city name (used to link existing venues).
export async function findCityByName(name) {
  const data = await geonames('searchJSON', { q: name, featureClass: 'P', orderby: 'relevance', maxRows: '1' });
  const hit = data.geonames?.[0];
  return hit ? Number(hit.geonameId) : null;
}

// Makes sure a `cities` row exists for this GeoNames id; returns it.
// `admin` must be the service-role client (cities aren't client-writable).
export async function ensureCity(admin, geonameId) {
  const id = Number(geonameId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const { data: existing } = await admin.from('cities').select('*').eq('geoname_id', id).maybeSingle();
  if (existing) return existing;

  const g = await geonames('getJSON', { geonameId: String(id) });
  if (g.fcl !== 'P') return null; // not a populated place
  const row = {
    geoname_id: id,
    name_en: preferredName(g.alternateNames, 'en') ?? g.toponymName ?? g.name,
    name_pl: preferredName(g.alternateNames, 'pl'),
    country_code: g.countryCode ?? null,
    lat: g.lat ? Number(g.lat) : null,
    lng: g.lng ? Number(g.lng) : null,
  };
  const { data: saved, error } = await admin.from('cities').upsert(row).select('*').single();
  if (error) throw error;
  return saved;
}
