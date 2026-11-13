import FullMarketingPage from '@/components/marketing/full-product';
import { PhaseOneFeatures } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';
import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata = marketingPageMetadata({
  title: 'Product | Constructa',
  description:
    'See how Constructa connects briefing, pricing, programme and proposals for small and medium UK contractors.',
  pathname: '/product',
});

export default function ProductPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneFeatures />;
}
