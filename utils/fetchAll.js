// Supabase returns at most 1000 rows per request and silently drops the
// rest, so any list that can grow past that (setlist rows across all your
// shows, every song of every artist you've seen) has to be paged.

const PAGE_SIZE = 1000;
// Keeps `.in(...)` filters short enough for the request URL.
const IN_CHUNK = 150;

// `makeQuery` builds a fresh select (filters included) for each page. Pages
// are ordered by `id` so none are skipped or repeated.
export async function fetchAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery()
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// fetchAll with `.in(column, values)`, split into chunks of values.
export async function fetchAllIn(makeQuery, column, values) {
  if (!values.length) return [];
  const chunks = [];
  for (let i = 0; i < values.length; i += IN_CHUNK) chunks.push(values.slice(i, i + IN_CHUNK));
  const results = await Promise.all(chunks.map((chunk) => fetchAll(() => makeQuery().in(column, chunk))));
  return results.flat();
}
