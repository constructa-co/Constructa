import { PhaseOneAbout } from '@/components/marketing/cohort-about';
import { FullAboutPage } from '@/components/marketing/full-about';
import { getLaunchProfile } from '@/lib/launch-profile';
import { marketingPageMetadata } from '@/lib/marketing-seo';

export const metadata = marketingPageMetadata({
  title: 'About | Constructa',
  description:
    'Learn how Constructa was built for small construction teams to quote faster, plan better, and deliver jobs with confidence.',
  pathname: '/about',
});

const aboutJsonLd = `{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Constructa",
  "url": "https://constructa.co/about",
  "description": "Constructa was created to help small construction teams quote faster, plan better, and deliver jobs with confidence. Built by people who know the industry.",
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