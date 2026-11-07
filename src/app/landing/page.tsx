import FullMarketingPage from '@/components/marketing/full-landing';
import { PhaseOneHome } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export default function LandingPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneHome />;
}
