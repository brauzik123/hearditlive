// Typed dates in the log form. Browsers' own date inputs always show the
// device's regional format (10/21/2026 on a US-set computer), so the form
// uses a text field instead: dd-mm-yyyy, or the order picked in Settings
// (mm/dd/yyyy, yyyy-mm-dd). Values in and out are ISO "2026-10-21".

const LAYOUTS = {
  mdy: { order: ['m', 'd', 'y'], sep: '/' },
  iso: { order: ['y', 'm', 'd'], sep: '-' },
  dmy: { order: ['d', 'm', 'y'], sep: '-' },
};
const LENGTH = { d: 2, m: 2, y: 4 };

const layoutFor = (dateFormat) => LAYOUTS[dateFormat] ?? LAYOUTS.dmy;

// "dd-mm-yyyy" (or "dd-mm-rrrr" in Polish) for the placeholder.
export function datePlaceholder(dateFormat, locale) {
  const letters = { d: 'dd', m: 'mm', y: locale === 'pl' ? 'rrrr' : 'yyyy' };
  const { order, sep } = layoutFor(dateFormat);
  return order.map((part) => letters[part]).join(sep);
}

export function formatDateInput(iso, dateFormat) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return '';
  const parts = { y: match[1], m: match[2], d: match[3] };
  const { order, sep } = layoutFor(dateFormat);
  return order.map((part) => parts[part]).join(sep);
}

// Digits only, with the separators put back in as you type: "21102026" and
// "21-10-2026" both become "21-10-2026".
export function maskDateInput(text, dateFormat) {
  const digits = (text ?? '').replace(/\D/g, '').slice(0, 8);
  const { order, sep } = layoutFor(dateFormat);
  let out = '';
  let used = 0;
  for (const part of order) {
    const chunk = digits.slice(used, used + LENGTH[part]);
    if (!chunk) break;
    out += (out ? sep : '') + chunk;
    used += chunk.length;
  }
  return out;
}

// ISO date for a complete, real date ("31-02-2026" is not); otherwise null.
export function parseDateInput(text, dateFormat) {
  const digits = (text ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const { order } = layoutFor(dateFormat);
  const parts = {};
  let used = 0;
  for (const part of order) {
    parts[part] = digits.slice(used, used + LENGTH[part]);
    used += LENGTH[part];
  }
  const [y, m, d] = [Number(parts.y), Number(parts.m), Number(parts.d)];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${parts.y}-${parts.m}-${parts.d}`;
}
