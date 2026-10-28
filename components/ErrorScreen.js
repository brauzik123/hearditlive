import Link from 'next/link';

// Shared look for "not found" and "something went wrong": a big marquee
// line, a short explanation, and a way out.
export default function ErrorScreen({ big, title, body, children }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="marquee text-8xl text-brand" aria-hidden="true">
        {big}
      </p>
      <h1 className="marquee text-4xl">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </main>
  );
}

export function HomeLink({ label }) {
  return (
    <Link
      href="/"
      className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:border-brand"
    >
      {label}
    </Link>
  );
}
