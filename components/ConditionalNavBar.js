'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';

// Pre-auth screens get no navigation.
const HIDDEN_ON = ['/login', '/reset-password'];

export default function ConditionalNavBar() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;
  return <NavBar />;
}
