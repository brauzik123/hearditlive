import { describe, expect, it, vi } from 'vitest';
import { LIMITS, rateLimit } from './rateLimit';

const fakeAdmin = (result) => ({ rpc: vi.fn(async () => result) });

describe('rateLimit', () => {
  it('lets the request through when every rule is under its limit', async () => {
    const admin = fakeAdmin({ data: null, error: null });
    expect(await rateLimit(admin, 'setlistSearch', 'user-1')).toBeNull();
  });

  it('sends per-user buckets first and the app-wide budget last', async () => {
    const admin = fakeAdmin({ data: null, error: null });
    await rateLimit(admin, 'setlistSearch', 'user-1');
    const [fn, { p_rules }] = admin.rpc.mock.calls[0];
    expect(fn).toBe('take_rate_limits');
    expect(p_rules.map((r) => r.bucket)).toEqual([
      'setlistSearch:user-1:60',
      'setlistSearch:user-1:86400',
      'setlistSearch:all:86400',
    ]);
  });

  it('answers 429 with Retry-After when a limit is hit', async () => {
    const res = await rateLimit(fakeAdmin({ data: 42, error: null }), 'citySearch', 'user-1');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(await res.json()).toMatchObject({ retryAfter: 42 });
  });

  it('lets requests through if the limiter itself is down', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const admin = fakeAdmin({ data: null, error: { message: 'function take_rate_limits does not exist' } });
    expect(await rateLimit(admin, 'syncArtist', 'user-1')).toBeNull();
    warn.mockRestore();
  });

  it("keeps setlist.fm's app-wide budget under its 1440-a-day cap", () => {
    const daily = LIMITS.setlistSearch.find((r) => r.scope === 'all' && r.window === 86400);
    expect(daily.max).toBeLessThan(1440);
  });
});
