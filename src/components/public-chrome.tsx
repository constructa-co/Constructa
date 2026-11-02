'use client';

import type { ReactNode } from 'react';
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
  const marketingBypass = showMarketing && getLaunchProfile() !== 'full';

  return <>
    {marketingBypass && <a href="#public-marketing-content" className={`${ui.theme} ${ui.skip}`}>Skip to content</a>}
    {showMarketing && <Header />}
    <main id={marketingBypass ? 'public-marketing-content' : undefined}
      tabIndex={marketingBypass ? -1 : undefined}>{children}</main>
    {showMarketing && !landingHasOwnFooter && <Footer />}
  </>;
}
