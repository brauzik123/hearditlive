// The installable app ("Add to Home Screen"): name, colours, full-screen
// display and the ticket icons from scripts/make-icons.mjs.
export default function manifest() {
  return {
    name: 'Heard It Live',
    short_name: 'Heard It Live',
    description: 'Every show, every setlist, every song you’ve heard live.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1b1838',
    theme_color: '#1b1838',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
