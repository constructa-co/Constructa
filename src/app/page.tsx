import FullMarketingPage from '@/components/marketing/full-home';
import { PhaseOneHome } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';

export default function Home() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneHome />;
}
