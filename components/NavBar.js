'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { Home, Grid, User, PlusCircle, Music2 } from 'lucide-react';

const links = [
  { href: '/collection', label: 'Collection', icon: Grid },
  { href: '/', label: 'Home', icon: Home },
  { href: '/songs', label: 'Songs', icon: Music2 },
  { href: '/profile', label: 'Profile', icon: User },
];

// Small dot-with-count on the Profile tab for pending follow requests.
function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-brand text-brand-foreground text-[10px] font-bold flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function NavBar() {
  const pathname = usePathname();
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

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-surface border-t border-border z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="flex items-center justify-around p-2 md:max-w-5xl md:mx-auto md:justify-between md:px-6 md:py-3">

        {/* Desktop logo */}
        <Link href="/" className="hidden md:block font-bold text-xl tracking-tight text-foreground">
          Heard<span className="text-brand">It</span>Live
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active ? 'text-foreground' : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="relative">
                  <Icon size={18} />
                  {href === '/profile' && <Badge count={pendingRequests} />}
                </span>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Desktop right side: log button + profile avatar */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/log"
            className="flex items-center gap-2 bg-brand text-brand-foreground px-4 py-2 rounded-full text-sm font-bold hover:opacity-90 transition"
          >
            <PlusCircle size={16} />
            Log a Concert
          </Link>
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-surface-light border border-border flex items-center justify-center hover:border-muted transition"
          >
            <User size={16} className="text-muted" />
          </Link>
        </div>

        {/* Mobile tab bar */}
        <div className="flex w-full items-center justify-around md:hidden">
          {links.slice(0, 2).map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex flex-col items-center gap-1 px-3 py-1">
                <Icon size={22} className={active ? 'text-foreground' : 'text-muted'} />
                <span className={`text-[10px] ${active ? 'text-foreground' : 'text-muted'}`}>{label}</span>
              </Link>
            );
          })}

          <Link href="/log" className="flex flex-col items-center -mt-6">
            <span className="w-12 h-12 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/30">
              <PlusCircle size={26} />
            </span>
          </Link>

          {links.slice(2).map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex flex-col items-center gap-1 px-3 py-1">
                <span className="relative">
                  <Icon size={22} className={active ? 'text-foreground' : 'text-muted'} />
                  {href === '/profile' && <Badge count={pendingRequests} />}
                </span>
                <span className={`text-[10px] ${active ? 'text-foreground' : 'text-muted'}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
