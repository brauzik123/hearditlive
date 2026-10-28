# Heard It Live

A concert logbook, in the spirit of Letterboxd for live music. Log every show
you've been to (or are going to), with the setlist, photos, a rating and who you
went with, then see what you've actually heard live: which songs, how much of
each artist's discography, which venues, cities and festivals.

The app is in English and Polish, built mobile-first, and currently a private,
non-commercial project for friends.

## Features

- **Log a show** in four short steps: the show, how it was, photos and setlist,
  people and privacy. Ratings are optional, from half a star to 10 stars.
  Upcoming shows track whether you've got a ticket yet.
- **setlist.fm import**: finds the show by artist and date and fills in the
  venue, city, tour and full setlist.
- **Songs**: every artist you've heard live, with your share of their
  discography, grouped into albums, singles, features and bands they're in
  (catalog from Spotify).
- **Stats**: events, sets, artists, songs, cities and venues. A festival in one
  year, or a support act plus the headliner on one night, counts as one event.
  Your "lineup" is billed like a festival poster.
- **Festival pages**, a **collection** with photo and list views, and a
  **"Were you there?"** prompt for planned shows whose date has passed.
- **Friends**: follow people, see their shows on Home, browse their Songs.
  Profiles and shows can be public, friends-only or private, enforced by the
  database (row-level security), not just the UI.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19, React Compiler) |
| Styling | Tailwind CSS v4 |
| Database, auth, storage | [Supabase](https://supabase.com) (Postgres with row-level security) |
| Music catalog | Spotify Web API (client credentials), MusicBrainz for band memberships |
| Setlists | [setlist.fm API](https://api.setlist.fm/docs/1.0/index.html) |
| Places | [GeoNames](https://www.geonames.org) (cities, so "Warsaw" and "Warszawa" are one city) |
| Tests | [Vitest](https://vitest.dev) |

## Getting started

You need Node.js 24, a Supabase project, and API credentials for Spotify,
setlist.fm and GeoNames (all free for non-commercial use).

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

Apply the database schema to your Supabase project (once, and again whenever
`supabase/migrations/` changes):

```bash
npx supabase link            # pick your project
npx supabase db push
```

Start the app:

```bash
npm run dev
```

It runs at http://localhost:3000. To try it on a phone on the same network,
open `http://<your computer's LAN IP>:3000` and add that IP to
`allowedDevOrigins` in `next.config.mjs`.

### Environment variables

See [`.env.example`](.env.example). Only the two `NEXT_PUBLIC_` values reach
the browser; everything else stays on the server.

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase connection (public, protected by row-level security) |
| `SUPABASE_SECRET_KEY` | Server only: writes to the shared music catalog, account deletion, rate limits |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Artist discographies and photos |
| `SETLISTFM_API_KEY` | Setlist import |
| `GEONAMES_USERNAME` | City suggestions |
| `CONTACT_EMAIL` | Optional contact address on the privacy page |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests, once (`npm run test:watch` re-runs on save) |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / serve it |

Every push to `main` and every pull request runs lint, tests and a production
build on GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Project structure

```
app/                    Pages and API routes (Next.js App Router)
  api/                  Server endpoints: setlist.fm search, catalog sync,
                        city search, venue matching, account deletion
  log/                  The log/edit form
    _components/        Its sections (private folder, not a route)
    _lib/               Form state <-> database mapping, saving
  error.js, not-found.js, global-error.js   Error and 404 pages
components/             Shared UI (TicketStub, StarRating, nav, ...)
i18n/                   Translations (dictionaries/en.js, pl.js) and helpers
utils/                  Server and shared logic
  catalogSync.js        Spotify catalog sync and its safeguards
  releases.js           Which releases count and where each song belongs
  songsData.js          Data for the Songs pages
  outings.js            What counts as one event
  rateLimit.js          Per-account limits on the API routes
  fetchAll.js           Paging past Supabase's 1000-row limit
  checked.js            Turns failed queries into real errors
supabase/migrations/    Database schema, policies and functions, in order
proxy.js                Request middleware (sessions, signed-out redirects)
```

Tests sit next to the code they cover (`*.test.js`).

## Working on it

- **Next.js 16 differs from older versions.** For example, `params` and
  `searchParams` are Promises, middleware lives in `proxy.js`, and `error.js`
  gets `retry` rather than `reset`. The docs for the installed version are in
  `node_modules/next/dist/docs/`.
- **Database changes** go in a new numbered file in `supabase/migrations/`,
  written so it can safely run twice (`if not exists`), then
  `npx supabase db push`.
- **Text** never goes straight into components: add it to both
  `i18n/dictionaries/en.js` and `pl.js`. A test fails if a key is missing from
  either. Polish copy avoids gendered forms.
- **Failed queries should fail loudly.** Wrap server-side queries in
  `checked()` so an error shows the error page instead of an empty list.
- **Shared catalog writes** (artists' songs and albums) only happen on the
  server with the secret key; browsers can read the catalog but not change it.

## External APIs and their limits

The app is careful with other people's services:

- **setlist.fm**: free for non-commercial use only, with at most 2 requests a
  second and 1,440 a day. Searches only happen when someone taps "Find this show
  on setlist.fm", and the app caps itself at 1,200 a day. Setlist data is always
  credited to setlist.fm with a link. Commercial use would need their permission.
- **Spotify**: each artist's catalog is synced at most once every 30 days. If
  Spotify rate-limits the app, every sync pauses app-wide until it's allowed
  again. Never re-sync many artists at once: a burst of full re-syncs can get
  the app blocked for about a day.
- **MusicBrainz**: one request per second, with a descriptive User-Agent.
- **GeoNames**: the app caps city searches at 900 an hour (the free tier allows 1,000).

All API routes also have per-account rate limits (`utils/rateLimit.js`,
counted in the database).

## Privacy

Photos are stored privately and shown through short-lived signed links;
avatars are public. Deleting an account removes all of its shows, photos and
connections. See the in-app privacy page (`/privacy`).
