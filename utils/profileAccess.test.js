import { describe, expect, it } from 'vitest';
import { visibleTo } from './profileAccess';

describe('visibleTo', () => {
  const stranger = { isSelf: false, isFriend: false };
  const friend = { isSelf: false, isFriend: true };
  const self = { isSelf: true, isFriend: false };

  it('lets everyone see what is public', () => {
    expect(visibleTo(['public', 'public'], stranger)).toBe(true);
  });

  it('lets only friends past a friends-only setting', () => {
    expect(visibleTo(['public', 'friends'], stranger)).toBe(false);
    expect(visibleTo(['public', 'friends'], friend)).toBe(true);
  });

  it('lets a page setting narrow the profile, never widen it', () => {
    // Public Collection on a friends-only profile is still friends-only.
    expect(visibleTo(['friends', 'public'], stranger)).toBe(false);
    // A private Stats page on a public profile is hidden even from friends.
    expect(visibleTo(['public', 'private'], friend)).toBe(false);
  });

  it('always shows you your own pages', () => {
    expect(visibleTo(['private', 'private'], self)).toBe(true);
  });
});
