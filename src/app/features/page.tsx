import FullMarketingPage from '@/components/marketing/full-features';
import { PhaseOneFeatures } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export default function FeaturesPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneFeatures />;
}
