import FullMarketingPage from '@/components/marketing/full-pricing';
import { PhaseOnePricing } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export default function PricingPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOnePricing />;
}
