import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import en from './dictionaries/en';
import pl from './dictionaries/pl';

const ROOT = path.resolve(__dirname, '..');

// Every key path to a string or a plural entry ({ one, other, ... }).
function leaves(dict, prefix = '') {
  return Object.entries(dict).flatMap(([key, value]) =>
    value && typeof value === 'object' && !('other' in value) ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) return sourceFiles(full);
    return f.name.endsWith('.js') && !f.name.endsWith('.test.js') ? [full] : [];
  });
}

// Keys used in the code: literal t('...') calls, plus keys kept in
// variables (e.g. summary tiles) and keys built from a fixed list of values.
function usedKeys() {
  const keys = new Set();
  for (const file of [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'components'))]) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([^'$]+)'/g)) keys.add(m[1]);
    for (const m of src.matchAll(/'((?:home|login|stats)\.[a-zA-Z.]+)'/g)) keys.add(m[1]);
  }
  const built = {
    'collection.sort': ['date_desc', 'date_asc', 'rating_desc', 'artist_asc'],
    'entry.visibility': ['public', 'friends', 'private'],
    'friends.tabs': ['activity', 'friends', 'requests', 'find'],
    'profile.visibilityNote': ['friends', 'private'],
    visibility: ['public', 'friends', 'private'],
    'settings.visibilityHint': ['public', 'friends', 'private'],
    nav: ['home', 'collection', 'songs', 'stats', 'profile', 'log'],
    'profile.follow': ['none', 'pending', 'following'],
    ticketStatus: ['interested', 'bought', 'not_yet'],
    'settings.dateFormats': ['long', 'dmy', 'mdy', 'iso'],
    collection: ['list', 'photos'],
    'log.steps': ['basics', 'details', 'media', 'people'],
  };
  for (const [prefix, values] of Object.entries(built)) values.forEach((v) => keys.add(`${prefix}.${v}`));
  return [...keys].sort();
}

describe('dictionaries', () => {
  it('have the same keys in English and Polish', () => {
    const enKeys = new Set(leaves(en));
    const plKeys = new Set(leaves(pl));
    expect([...enKeys].filter((k) => !plKeys.has(k))).toEqual([]);
    expect([...plKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('have every key the app uses', () => {
    const missing = usedKeys().flatMap((key) =>
      [['en', en], ['pl', pl]].filter(([, dict]) => lookup(dict, key) == null).map(([lang]) => `${lang}: ${key}`)
    );
    expect(missing).toEqual([]);
  });

  it('give Polish plurals every form they need', () => {
    const plurals = leaves(pl)
      .map((key) => [key, lookup(pl, key)])
      .filter(([, value]) => typeof value === 'object');
    const incomplete = plurals.filter(([, v]) => !v.one || !v.few || !v.many).map(([key]) => key);
    expect(incomplete).toEqual([]);
  });
});
