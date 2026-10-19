// Only photos from our own avatars bucket are shown. avatar_url is written
// by its owner, so without this check anyone could point it at an outside
// URL (e.g. a tracking pixel that logs who views their profile).
const AVATAR_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;

// Profile photo, or a monogram when there isn't one. The monogram's hue
// comes from the username, so each person keeps a recognisable colour.
export default function Avatar({ username, src, size = 40 }) {
  const name = username ?? '?';

  if (src?.startsWith(AVATAR_PREFIX)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-surface object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

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
