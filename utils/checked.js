// Supabase reports failures in `error` instead of throwing, so a failed
// query quietly looks like "no data" — an empty Collection, zero stats.
// Wrapping a result in checked() turns the failure into a real error, which
// the nearest error.js shows with a "Try again" button. Returns the result
// unchanged, so `{ data }` / `{ count }` destructuring keeps working:
//
//   const { data } = checked(await supabase.from('x').select());
//   const [{ data: a }, { count }] = (await Promise.all([q1, q2])).map(checked);
export function checked(result) {
  if (result?.error) {
    const err = new Error(result.error.message ?? 'Database request failed');
    err.code = result.error.code;
    throw err;
  }
  return result;
}
