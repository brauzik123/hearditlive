'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';

const HIDDEN_ON = ['/login'];

export default function ConditionalNavBar() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;
  return <NavBar />;
}
