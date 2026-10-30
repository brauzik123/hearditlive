import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_WAIT_S, nextSyncStep, syncArtistPaced } from './artistSyncClient';

const respondWith = (...bodies) => {
  const fetchMock = vi.fn();
  bodies.forEach((body) => fetchMock.mockResolvedValueOnce({ json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe('nextSyncStep', () => {
  it('is done unless the server deferred it', () => {
    expect(nextSyncStep({ ok: true })).toBe('done');
    expect(nextSyncStep({ error: 'Sync failed' })).toBe('done');
    expect(nextSyncStep(null)).toBe('done');
  });

  it('waits until just after the next slot opens', () => {
    expect(nextSyncStep({ deferred: true, retryAfter: 100 })).toBe(102000);
    expect(nextSyncStep({ deferred: true, retryAfter: 0 })).toBe(3000);
  });

  it('pauses for hour or day limits and Spotify blocks', () => {
    expect(nextSyncStep({ deferred: true, retryAfter: MAX_WAIT_S + 1 })).toBe('paused');
    expect(nextSyncStep({ deferred: true })).toBe('paused');
  });
});

describe('syncArtistPaced', () => {
  it('asks again after waiting its turn, then finishes', async () => {
    const fetchMock = respondWith({ deferred: true, retryAfter: 60 }, { ok: true });
    const wait = vi.fn(async () => {});
    const onWait = vi.fn();
    expect(await syncArtistPaced('a1', 'u1', { wait, onWait })).toBe('done');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(62000);
    expect(onWait).toHaveBeenCalledTimes(1);
  });

  it('gives up for this visit on a long wait', async () => {
    const fetchMock = respondWith({ deferred: true, retryAfter: 3000 });
    expect(await syncArtistPaced('a1')).toBe('paused');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops asking once the page is left', async () => {
    const fetchMock = respondWith({ deferred: true, retryAfter: 60 }, { ok: true });
    let left = false;
    const wait = async () => {
      left = true;
    };
    expect(await syncArtistPaced('a1', null, { wait, isStopped: () => left })).toBe('stopped');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a network failure as done, so the queue moves on', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await syncArtistPaced('a1')).toBe('done');
  });
});
