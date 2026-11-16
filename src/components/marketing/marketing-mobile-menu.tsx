'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import ui from './phase-one.module.css';

type Menu = Pick<HTMLDetailsElement, 'open' | 'contains' | 'querySelector'>;

// Focus returns to the Menu control only when it would otherwise be left on a hidden link.
export function closeMobileMenu(menu: Menu | null, focused: Node | null = null) {
  if (!menu?.open) return false;
  menu.open = false;
  if (focused && menu.contains(focused)) menu.querySelector<HTMLElement>('summary')?.focus();
  return true;
}

export function MarketingMobileMenu() {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu(menu.current, document.activeElement);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeOnSelection = () => { closeMobileMenu(menu.current); };

  return (
    <details ref={menu} className={ui.mobileMenu}>
      <summary>Menu</summary>
      <nav aria-label="Mobile navigation">
        <Link href="/features" onClick={closeOnSelection}>Product</Link>
        <Link href="/pricing" onClick={closeOnSelection}>Preview access</Link>
        <Link href="/about" onClick={closeOnSelection}>About</Link>
        <Link href="/guides" onClick={closeOnSelection}>Guides</Link>
        <Link href="/login" onClick={closeOnSelection}>Sign in</Link>
      </nav>
    </details>
  );
}
