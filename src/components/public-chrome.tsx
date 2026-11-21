'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getLaunchProfile } from '@/lib/launch-profile';
import Header from './Header';
import Footer from './Footer';
import ui from './marketing/phase-one.module.css';

export default function PublicChrome({ children }: { children: ReactNode }) {
  // Root layouts persist across navigation; chrome must follow the client route.
  const pathname = usePathname() || '';
  const isApplication = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth/') || pathname.startsWith('/admin') || pathname === '/login';
  const isPublicProposal = pathname.startsWith('/proposal/');
  const showMarketing = !isApplication && !isPublicProposal;
  const landingHasOwnFooter = pathname === '/landing' && getLaunchProfile() === 'full';
  const marketingBypass = showMarketing;
  const cohortMarketingTheme = showMarketing && getLaunchProfile() !== 'full';

  // Restrained section-entry motion for marketing pages: sections opt in with
  // data-reveal. Hidden states only apply once this effect arms the document,
  // so content stays fully visible without JavaScript. Reduced-motion users
  // get every section immediately, with no transition.
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return;
    const root = document.documentElement;
    root.classList.add('reveal-armed');
    const revealAll = () => targets.forEach(el => el.classList.add('reveal-in'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return () => { root.classList.remove('reveal-armed'); };
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    for (const el of targets) {
      const box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('reveal-in');
      else observer.observe(el);
    }
    return () => {
      observer.disconnect();
      root.classList.remove('reveal-armed');
    };
  }, [pathname]);

  const skipClassName = cohortMarketingTheme
    ? `${ui.theme} ${ui.skip}`
    : 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white';
  const mainClassName = cohortMarketingTheme
    ? `${ui.theme} ${ui.marketingMain}`
    : marketingBypass
      ? 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
      : undefined;

  return <>
    {marketingBypass && <a href="#public-marketing-content" className={skipClassName}>Skip to content</a>}
    {showMarketing && <Header />}
    <main
      id={marketingBypass ? 'public-marketing-content' : undefined}
      className={mainClassName}
      tabIndex={marketingBypass ? -1 : undefined}
    >{children}</main>
    {showMarketing && !landingHasOwnFooter && <Footer />}
  </>;
}
