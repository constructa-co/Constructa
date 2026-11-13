import FullMarketingPage from '@/components/marketing/full-features';
import { PhaseOneFeatures } from '@/components/marketing/phase-one';
import { getLaunchProfile } from '@/lib/launch-profile';
import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata = marketingPageMetadata({
  title: 'Features | Constructa',
  description:
    'Company profile, brief, estimate, programme and proposal in one connected journey for UK construction contractors.',
  pathname: '/features',
});

export default function FeaturesPage() {
  return getLaunchProfile() === 'full' ? <FullMarketingPage /> : <PhaseOneFeatures />;
}
