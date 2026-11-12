import FullMarketingPage from '@/components/marketing/full-product';
import { PhaseOneFeatures } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export default function ProductPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneFeatures />;
}
