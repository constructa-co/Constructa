'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import {
  isPublicPageviewMeasurementEnabled,
  filterPageviewEvent,
  hasSignedInSessionCookie,
  isPublicMeasurementRoute,
} from '@/lib/public-measurement';

/**
 * Vercel Web Analytics for public marketing routes only. The root layout
 * persists across client navigation, so the route is checked on every change:
 * the component unmounts (and stops counting) as soon as the visitor reaches
 * an application, auth, admin, proposal or unknown route, or has a session.
 * Renders nothing until mounted, so the server HTML never carries a loader.
 */
export default function PublicAnalytics() {
  const pathname = usePathname();
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    setSignedOut(!hasSignedInSessionCookie(document.cookie));
  }, [pathname]);

  if (!isPublicPageviewMeasurementEnabled() || !signedOut) return null;
  if (!pathname || !isPublicMeasurementRoute(pathname)) return null;

  return (
    <Analytics
      beforeSend={(event) => filterPageviewEvent(event, document.cookie)}
    />
  );
}
