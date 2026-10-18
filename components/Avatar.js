// Monogram avatar. The hue comes from the username, so each person keeps a
// recognisable colour everywhere without anyone uploading a photo.
export default function Avatar({ username, size = 40 }) {
  const name = username ?? '?';
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;

  return (
    <span
      aria-hidden="true"
      className="marquee inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        background: `oklch(0.78 0.11 ${hue})`,
        color: 'var(--paper-ink)',
      }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
