import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicChrome from '@/components/public-chrome';
import { GuideArticleView } from './guide-article-view';
import { GuidesHub } from './guides-hub';
import { getGuideArticle } from '@/lib/marketing-guides';
import { PhaseOneFeatures, PhaseOneHome, PhaseOnePricing } from './phase-one';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({}) }));

afterEach(() => { vi.unstubAllEnvs(); route.pathname = '/'; });

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const globalCss = () => readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

describe('marketing section-entry reveal motion', () => {
  it('marks the major marketing sections for reveal while leaving the animated hero alone', () => {
    const home = renderToStaticMarkup(<PhaseOneHome />);
    expect((home.match(/data-reveal="true"/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(home).toMatch(/<section id="how-it-works"[^>]*data-reveal="true"/);
    const hero = home.match(/<section id="marketing-content"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(hero).not.toContain('data-reveal');

    const features = renderToStaticMarkup(<PhaseOneFeatures />);
    expect(features).toContain('id="product-screenshots"');
    expect(features).toContain('data-reveal="true"');

    const pricing = renderToStaticMarkup(<PhaseOnePricing />);
    expect((pricing.match(/data-reveal="true"/g) ?? []).length).toBeGreaterThanOrEqual(3);

    for (const markup of [renderToStaticMarkup(<GuidesHub />), renderToStaticMarkup(
      <GuideArticleView article={getGuideArticle('review-brief-and-price')!} />,
    )]) {
      expect((markup.match(/data-reveal="true"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('reveals sections once through an intersection observer, armed only in the client effect', () => {
    const chrome = source('../public-chrome.tsx');
    expect(chrome).toContain("querySelectorAll<HTMLElement>('[data-reveal]')");
    expect(chrome).toContain("classList.add('reveal-armed')");
    expect(chrome).toContain("classList.add('reveal-in')");
    expect(chrome).toContain('new IntersectionObserver');
    expect(chrome).toContain("(prefers-reduced-motion: reduce)");
    expect(chrome).toContain('observer.disconnect()');
    // Static markup must not carry hidden states or scripts.
    const html = renderToStaticMarkup(<PublicChrome><p>Body</p></PublicChrome>);
    expect(html).not.toContain('reveal-armed');
    expect(html).not.toContain('<script');
  });

  it('keeps the reveal transition restrained and honours prefers-reduced-motion', () => {
    const css = globalCss();
    expect(css).toContain('.reveal-armed [data-reveal]');
    expect(css).toContain('.reveal-armed [data-reveal].reveal-in');
    expect(css).toContain('transform: translateY(26px)');
    expect(css).not.toContain('infinite');
    expect(css).not.toContain('animation:');
    const reduceBlock = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.reveal-armed \[data-reveal\][\s\S]*?\}/);
    expect(reduceBlock).toBeTruthy();
    expect(reduceBlock![0]).toContain('opacity: 1');
    expect(reduceBlock![0]).toContain('transition: none');
  });
});
