import { describe, expect, it } from 'vitest';
import { normalizeSongName } from './normalize';

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
