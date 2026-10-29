import { describe, expect, it } from 'vitest';
import { hasAnyTag, tagNamesOf } from './tags';

const show = (...names) => ({ entry_tags: names.map((name) => ({ tags: { name } })) });

describe('tags', () => {
  it('lists every tag once, alphabetically', () => {
    expect(tagNamesOf([show('road trip', 'front row'), show('front row'), {}])).toEqual(['front row', 'road trip']);
  });

  it('keeps shows with any of the chosen tags', () => {
    const shows = [show('front row'), show('road trip'), show()];
    expect(shows.filter((s) => hasAnyTag(s, ['front row', 'road trip']))).toHaveLength(2);
    expect(shows.filter((s) => hasAnyTag(s, ['front row']))).toHaveLength(1);
  });

  it('keeps everything when no tag is chosen', () => {
    expect(hasAnyTag(show(), [])).toBe(true);
  });
});
