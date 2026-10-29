'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, User, Plus, Music2, BarChart3 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';

const LINKS = [
  { href: '/', key: 'home', icon: Home },
  { href: '/collection', key: 'collection', icon: Ticket },
  { href: '/songs', key: 'songs', icon: Music2 },
  { href: '/stats', key: 'stats', icon: BarChart3 },
  { href: '/profile', key: 'profile', icon: User },
];

function isActive(pathname, href) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// Count of pending follow requests, shown on the Profile tab.
function Badge({ count, label }) {
  if (!count) return null;
  return (
    <span
      aria-label={label}
      className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-brand text-brand-foreground text-[10px] font-bold flex items-center justify-center"
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [pendingRequests, setPendingRequests] = useState(0);

  // Re-checked on every navigation, so accepting a request on /friends
  // clears the badge as soon as you move on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', session.user.id)
        .eq('status', 'pending');
      if (!cancelled) setPendingRequests(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const badgeLabel = t('nav.requests', { count: pendingRequests });

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t border-border bg-background/95 backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      {/* Desktop */}
      <div className="hidden md:flex mx-auto max-w-5xl items-center justify-between px-6 h-16">
        <Link href="/" className="marquee text-2xl tracking-wide">
          Heard It Live
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? 'bg-surface text-foreground' : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="relative">
                  <Icon size={17} />
                  {href === '/profile' && <Badge count={pendingRequests} label={badgeLabel} />}
                </span>
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </div>
        <Link
          href="/log"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground transition hover:brightness-105"
        >
          <Plus size={16} strokeWidth={2.5} /> {t('nav.log')}
        </Link>
      </div>

      {/* Mobile tab bar: two tabs, the log button, three tabs */}
      <div className="flex md:hidden items-end justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {[...LINKS.slice(0, 2), null, ...LINKS.slice(2)].map((link) => {
          if (!link) {
            return (
              <Link
                key="log"
                href="/log"
                aria-label={t('nav.log')}
                className="-mt-5 flex h-13 w-13 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_6px_20px_-6px_var(--brand)]"
              >
                <Plus size={26} strokeWidth={2.5} />
              </Link>
            );
          }
          const { href, key, icon: Icon } = link;
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex w-14 flex-col items-center gap-1 py-1 ${active ? 'text-foreground' : 'text-muted'}`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                {href === '/profile' && <Badge count={pendingRequests} label={badgeLabel} />}
              </span>
              <span className="max-w-full truncate text-[11px]">{t(`nav.${key}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
