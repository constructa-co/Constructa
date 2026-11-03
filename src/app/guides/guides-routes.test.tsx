import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PublicChrome from '@/components/public-chrome';
import { MarketingFooter } from '@/components/marketing/phase-one';
import { GuideArticleView } from '@/components/marketing/guide-article-view';
import { getAllGuideSlugs, getGuideArticle } from '@/lib/marketing-guides';
import GuidesPage from './page';
import GuideArticlePage, { generateStaticParams } from './[slug]/page';

const route = vi.hoisted(() => ({ pathname: '/guides' }));
const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('NOT_FOUND');
}));

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({}),
  notFound: () => notFoundMock(),
}));

function hubMarkup() {
  route.pathname = '/guides';
  return renderToStaticMarkup(
    <PublicChrome>
      <GuidesPage />
    </PublicChrome>,
  );
}

describe('guides hub and articles', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    notFoundMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes one main landmark and links hub cards to real articles', () => {
    const markup = hubMarkup();
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<main[\s\S]*<main/);
    expect(markup).toContain('href="/guides/review-brief-and-price"');
    expect(markup).toContain('href="/guides/programme-and-proposal-before-sharing"');
    expect(markup).toContain('existing review account');
    expect(markup).not.toContain('<form');
    expect(markup).not.toMatch(/Plausible|Formspree|Google Analytics|<iframe/i);
  });

  it('renders each article with navigation, qualifications and preview-access handoff', async () => {
    for (const slug of getAllGuideSlugs()) {
      route.pathname = `/guides/${slug}`;
      const markup = renderToStaticMarkup(
        <PublicChrome>
          {await GuideArticlePage({ params: Promise.resolve({ slug }) })}
        </PublicChrome>,
      );
      expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
      expect(markup).toContain('href="/guides"');
      expect(markup).toContain('Back to guides');
      expect(markup).toContain('href="/pricing"');
      expect(markup).toContain('How preview access works');
      expect(markup).toContain('held back from this preview');
      expect(markup).not.toContain('<form');
      if (slug === 'programme-and-proposal-before-sharing') {
        expect(markup).toContain('Downloading it sends nothing');
        expect(markup).toContain('non-binding intention to proceed');
      }
      if (slug === 'review-brief-and-price') {
        expect(markup).toContain('One-price items, quantities and rates');
      }
    }
  });

  it('calls notFound for an unknown slug', async () => {
    await expect(
      GuideArticlePage({ params: Promise.resolve({ slug: 'not-a-real-guide' }) }),
    ).rejects.toThrow('NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('generateStaticParams lists every authored slug once', () => {
    expect(generateStaticParams()).toEqual([
      { slug: 'review-brief-and-price' },
      { slug: 'programme-and-proposal-before-sharing' },
    ]);
  });

  it('binds step section aria-labelledby to one whitespace-free heading id and names recovery in the held note', () => {
    for (const slug of getAllGuideSlugs()) {
      const article = getGuideArticle(slug);
      expect(article).toBeTruthy();
      const markup = renderToStaticMarkup(<GuideArticleView article={article!} />);
      expect(markup).toContain('complete photo, consent and recovery journeys');
      const labelledSections = [...markup.matchAll(/<section[^>]*\saria-labelledby="([^"]+)"/g)];
      expect(labelledSections.length).toBeGreaterThan(0);
      for (const [, labelId] of labelledSections) {
        expect(labelId).not.toMatch(/\s/);
        const escaped = labelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idMatches = markup.match(new RegExp(`\\bid="${escaped}"`, 'g'));
        expect(idMatches?.length).toBe(1);
      }
    }
  });

  it('adds a discoverable Guides link in the phase-one footer only', () => {
    const footerHtml = renderToStaticMarkup(<MarketingFooter />);
    expect(footerHtml).toContain('href="/guides">Guides</a>');
    expect(footerHtml).toContain('href="/features">The product</a>');
    expect(footerHtml).toContain('href="/contact">Get in touch</a>');
  });
});
