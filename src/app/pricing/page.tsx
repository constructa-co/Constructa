import type { Metadata } from 'next';
import FullMarketingPage from '@/components/marketing/full-pricing';
import { PhaseOnePricing } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

import { marketingPageMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "Pricing | Constructa",
  description:
    "Phase-one preview access for Constructa. No subscription sale on this preview; illustrative job prices are examples only.",
  pathname: "/pricing",
});

export default function PricingPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOnePricing />;
}
