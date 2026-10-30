import { describe, expect, it } from 'vitest';
import { closeSongKey, normalizeSongName, sameArtistName } from './normalize';

describe('normalizeSongName', () => {
  it('matches setlist titles to Spotify titles despite case and punctuation', () => {
    expect(normalizeSongName("SICKO MODE")).toBe(normalizeSongName('Sicko Mode'));
    expect(normalizeSongName("Don't Stop")).toBe('don t stop');
  });

  it('drops featured artists', () => {
    expect(normalizeSongName('Goosebumps (feat. Kendrick Lamar)')).toBe('goosebumps');
    expect(normalizeSongName('Song (with Someone)')).toBe('song');
  });

  it('drops version suffixes in brackets or after a dash', () => {
    expect(normalizeSongName('Creep (2008 Remaster)')).toBe('creep');
    expect(normalizeSongName('Creep - Remastered 2009')).toBe('creep');
    expect(normalizeSongName('Creep - Acoustic')).toBe('creep');
    expect(normalizeSongName('Blinding Lights (Sped Up)')).toBe('blinding lights');
  });

  it('keeps brackets that are part of the title', () => {
    expect(normalizeSongName('Hey Jude (Reprise)')).toBe('hey jude reprise');
  });

  it('treats a missing name as empty', () => {
    expect(normalizeSongName(null)).toBe('');
  });
});

describe('sameArtistName', () => {
  it('ignores capitals, accents, punctuation, "&" and a leading "The"', () => {
    expect(sameArtistName('bts', 'BTS')).toBe(true);
    expect(sameArtistName('Beyonce', 'Beyoncé')).toBe(true);
    expect(sameArtistName('J Cole', 'J. Cole')).toBe(true);
    expect(sameArtistName('Florence + the Machine', 'Florence and The Machine')).toBe(true);
    expect(sameArtistName('Weeknd', 'The Weeknd')).toBe(true);
  });

  it('rejects a different artist', () => {
    expect(sameArtistName('Bulleez n Nerdz', 'The Bullseyes')).toBe(false);
    expect(sameArtistName('ArtistsCAN', 'Artists United Against Apartheid')).toBe(false);
    expect(sameArtistName('Travis Scot', 'Travis Scott')).toBe(false);
    expect(sameArtistName('', '')).toBe(false);
  });
});

describe('chopped & screwed versions', () => {
  it('match the original song', () => {
    expect(normalizeSongName('Raindrops (Insane) [with Travis Scott] - ChoppedNotSlopped')).toBe(normalizeSongName('Raindrops (Insane) [with Travis Scott]'));
    expect(normalizeSongName('Mo Bamba - Chopped & Screwed')).toBe('mo bamba');
  });
});

describe('square brackets', () => {
  it('drops guests and version tags in square brackets too', () => {
    expect(normalizeSongName('Niagara Falls (Foot or 2) [with Travis Scott & 21 Savage]')).toBe(normalizeSongName('Niagara Falls (Foot or 2)'));
    expect(normalizeSongName('I Can’t Save You (Interlude) [with Future & feat. Don Toliver]')).toBe(normalizeSongName("I Can't Save You (interlude)"));
    expect(normalizeSongName('All The Money (with Gunna) [Bonus]')).toBe('all the money');
    expect(normalizeSongName('Song [Remastered 2011]')).toBe('song');
  });

  it('keeps square brackets that are part of the title', () => {
    expect(normalizeSongName('Intro [Part 2]')).toBe('intro part 2');
  });
});

describe('setlist spellings', () => {
  it('matches on the title before a stylized "| SECOND TITLE"', () => {
    expect(normalizeSongName('SWITCH IT UP | ZW1TCH 1T UP')).toBe(normalizeSongName('SWITCH IT UP | ZWITCH 1T UP'));
    expect(normalizeSongName('SIRENS | Z1RENZ')).toBe('sirens');
  });

  it('drops an unbracketed feat.', () => {
    expect(normalizeSongName('WISH FEAT. KIDDO MARV')).toBe('wish');
    expect(normalizeSongName('Song featuring Someone')).toBe('song');
    expect(normalizeSongName('Defeat the Purpose')).toBe('defeat the purpose');
    expect(normalizeSongName('Feat of Strength')).toBe('feat of strength');
  });
});

describe('closeSongKey', () => {
  const catalog = ['anotha late nite', 'ultimate', 'clout cobain', 'run', 'sirens'];

  it('finds a title spelled almost the same', () => {
    expect(closeSongKey('anotha late night', catalog)).toBe('anotha late nite');
    expect(closeSongKey('clout cobian', catalog)).toBe('clout cobain');
  });

  it('never matches short titles or real differences', () => {
    expect(closeSongKey('fun', catalog)).toBeNull();
    expect(closeSongKey('zone 3', catalog)).toBeNull();
    expect(closeSongKey('sailin da south', catalog)).toBeNull();
  });

  it("doesn't guess between two equally close titles", () => {
    expect(closeSongKey('walking home', ['walkin home', 'walking hom'])).toBeNull();
  });
});
