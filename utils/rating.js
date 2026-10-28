// Ratings are 0.5–10 stars in half steps: "7.5" in English, "7,5" in
// Polish. Uses the app's language, not the browser's, so server and
// client render the same text.
export const formatRating = (rating, locale) =>
  Number(rating).toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-GB', { maximumFractionDigits: 1 });
