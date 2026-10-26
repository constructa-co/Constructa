import type { Metadata } from 'next';
import FullMarketingPage from '@/components/marketing/full-pricing';
import { PhaseOnePricing } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export const metadata: Metadata = { title: "Pricing | Constructa" };

export default function PricingPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOnePricing />;
}
