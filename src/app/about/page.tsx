import { PhaseOneAbout } from '@/components/marketing/cohort-about';
import { FullAboutPage } from '@/components/marketing/full-about';
import { getLaunchProfile } from '@/lib/launch-profile';
import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata = marketingPageMetadata({
  title: 'About | Constructa',
  description:
    'How Constructa helps small UK contractors organise their own brief, estimate, programme and proposal for review.',
  pathname: '/about',
});

const aboutJsonLd = `{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Constructa",
  "url": "https://constructa.co/about",
  "description": "Constructa brings contractor-entered scope, quantities, rates and working days together for review.",
  "publisher": {
    "@type": "Organization",
    "name": "Constructa",
    "url": "https://constructa.co"
  }
}`;

export default function About() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: aboutJsonLd }} />
      {getLaunchProfile() === 'full' ? <FullAboutPage /> : <PhaseOneAbout />}
    </>
  );
}