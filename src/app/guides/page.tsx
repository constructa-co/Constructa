import type { Metadata } from 'next';
import { GuidesHub } from '@/components/marketing/guides-hub';

export const metadata: Metadata = {
  title: 'Guides & Insights | Constructa',
  description:
    'Short phase-one review checklists for company profile, brief, price, programme and proposal — for existing review accounts only.',
};

export default function GuidesPage() {
  return <GuidesHub />;
}
