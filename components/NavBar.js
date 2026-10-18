'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, User, PlusCircle, Music2 } from 'lucide-react';

const links = [
  { href: '/collection', label: 'Collection', icon: Grid },
  { href: '/', label: 'Home', icon: Home },
  { href: '/songs', label: 'Songs', icon: Music2 },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function NavBar() {
  const pathname = usePathname();

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
                <Icon size={18} />
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
                <Icon size={22} className={active ? 'text-foreground' : 'text-muted'} />
                <span className={`text-[10px] ${active ? 'text-foreground' : 'text-muted'}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
