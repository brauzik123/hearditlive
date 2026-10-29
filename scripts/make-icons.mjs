// Generates the app icons (home screen, browser tab, PWA manifest):
//   node scripts/make-icons.mjs
// A yellow ticket stub on the app's indigo, with LIVE in the app's display
// face (Big Shoulders). Writes PNGs to app/ (icon, apple-icon) and public/.
import fs from 'fs';
import path from 'path';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const INDIGO = '#1b1838';
const AMBER = '#ffc23d';

// A very old user agent makes Google Fonts serve a plain TTF, which the
// renderer reads (it can't use variable fonts or woff2).
async function loadFont() {
  const css = await (
    await fetch('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800', {
      headers: { 'User-Agent': 'Mozilla/4.0' },
    })
  ).text();
  const url = css.match(/src: url\((.+?)\)/)?.[1];
  if (!url) throw new Error('Could not find the Big Shoulders font file');
  return (await fetch(url)).arrayBuffer();
}

// Plain React.createElement, so this runs with plain Node (no JSX build step).
function Ticket({ size }) {
  const u = (n) => Math.round(size * n);
  const notch = { position: 'absolute', top: u(0.25) - u(0.07), width: u(0.14), height: u(0.14), borderRadius: '50%', background: INDIGO };
  return h(
    'div',
    { style: { width: size, height: size, background: INDIGO, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    h(
      'div',
      { style: { position: 'relative', width: u(0.8), height: u(0.5), background: AMBER, borderRadius: u(0.07), display: 'flex', alignItems: 'center' } },
      h('div', { style: { ...notch, left: -u(0.07) } }),
      h('div', { style: { ...notch, right: -u(0.07) } }),
      h(
        'div',
        { style: { flex: 1, display: 'flex', justifyContent: 'center', fontFamily: 'Big Shoulders', fontSize: u(0.25), color: INDIGO } },
        'LIVE'
      ),
      h('div', { style: { height: u(0.36), borderLeft: `${Math.max(2, u(0.012))}px dashed ${INDIGO}`, marginRight: u(0.16) } })
    )
  );
}

const font = await loadFont();
const targets = [
  ['app/icon.png', 512],
  ['app/apple-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];
for (const [file, size] of targets) {
  const image = new ImageResponse(h(Ticket, { size }), {
    width: size,
    height: size,
    fonts: [{ name: 'Big Shoulders', data: font, weight: 800, style: 'normal' }],
  });
  fs.writeFileSync(path.resolve(file), Buffer.from(await image.arrayBuffer()));
  console.log(`wrote ${file} (${size}px)`);
}
