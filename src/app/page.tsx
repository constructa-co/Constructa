import FullMarketingPage from '@/components/marketing/full-home';
import { PhaseOneHome } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';
import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata = marketingPageMetadata({
  title: 'Constructa | Construction proposals and estimates',
  description:
    'Give your business the introduction it deserves. Bring company profile, price and programme into a proposal worth putting your name to.',
  pathname: '/',
});

export default function Home() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneHome />;
}
