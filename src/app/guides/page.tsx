import type { Metadata } from 'next';
import { GuidesHub } from '@/components/marketing/guides-hub';

import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata: Metadata = marketingPageMetadata({
  title: 'Guides & Insights | Constructa',
  description:
    'Short phase-one review checklists for company profile, brief, price, programme and proposal — for existing review accounts only.',
  pathname: '/guides',
  index: false,
});

export default function GuidesPage() {
  return <GuidesHub />;
}
