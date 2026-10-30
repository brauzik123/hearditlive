import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./spotify', () => ({
  ensureArtistImage: vi.fn(),
  getArtistReleases: vi.fn(),
  getReleaseCount: vi.fn(),
  getAlbumTracks: vi.fn(),
  searchTracks: vi.fn(),
  mapLimit: vi.fn(),
  spotifyBlockedUntil: vi.fn(),
  blockSpotify: vi.fn(),
  SpotifyRateLimitError: class extends Error {},
}));

import { ensureArtistImage, getArtistReleases, spotifyBlockedUntil } from './spotify';
import { ensureArtistSynced } from './catalogSync';

// A claim that fails (someone else holds it), so nothing past it runs.
const fakeSupabase = (budget) => {
  const chain = { update: () => chain, eq: () => chain, or: () => chain, select: async () => ({ data: [] }) };
  return { rpc: vi.fn(async () => ({ data: budget, error: null })), from: vi.fn(() => chain) };
};

const newArtist = { id: 'a1', name: 'Radiohead', catalog_synced_at: null, spotify_id: null };

describe('ensureArtistSynced budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spotifyBlockedUntil.mockResolvedValue(null);
  });

  it('defers a new artist when it is not their turn, without downloading anything', async () => {
    ensureArtistImage.mockResolvedValue({ ...newArtist, spotify_id: 'sp1' });
    const supabase = fakeSupabase(90);
    const result = await ensureArtistSynced(supabase, newArtist);
    expect(result).toMatchObject({ deferredSeconds: 90, spotify_id: 'sp1' });
    expect(supabase.rpc.mock.calls[0][1].p_rules[0].bucket).toBe('spotifyFullSync:all:120');
    expect(getArtistReleases).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('does not spend a turn on an artist who is not on Spotify', async () => {
    ensureArtistImage.mockResolvedValue(newArtist);
    const supabase = fakeSupabase(90);
    const result = await ensureArtistSynced(supabase, newArtist);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result.deferredSeconds).toBeUndefined();
  });

  it('calls nothing while Spotify has the app paused, and says for how long', async () => {
    spotifyBlockedUntil.mockResolvedValue(new Date(Date.now() + 3600 * 1000));
    const supabase = fakeSupabase(null);
    const result = await ensureArtistSynced(supabase, newArtist);
    expect(result.deferredSeconds).toBeGreaterThan(3500);
    expect(ensureArtistImage).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('goes ahead when there is budget', async () => {
    ensureArtistImage.mockResolvedValue({ ...newArtist, spotify_id: 'sp1' });
    const supabase = fakeSupabase(null);
    const result = await ensureArtistSynced(supabase, newArtist);
    expect(result.deferredSeconds).toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith('artists'); // reached the claim
  });
});
