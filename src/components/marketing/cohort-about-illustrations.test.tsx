import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhaseOneAbout } from './cohort-about';
import { FullAboutPage } from './full-about';

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; width?: number; height?: number; className?: string }) => (
    <img
      src={typeof props.src === 'string' ? props.src : '[imported-capture]'}
      alt={props.alt}
      width={props.width}
      height={props.height}
      className={props.className}
      data-next-image="true"
    />
  ),
}));

const aiPeopleSources = [
  '/images/about-hero.png',
  '/images/about-problem1.png',
  '/images/about-solution.png',
  '/images/founder-message.png',
  '/images/about-whats-next.png',
] as const;

const heroSource = '/images/minimalist infographic cluster of small construction buildings.png';
const problemSource = '/images/spreadsheet grid and warning & error symbols.png';

describe('About illustration panels without AI-generated people (cohort + full)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
    ['full', () => renderToStaticMarkup(<FullAboutPage />)],
  ])('%s renders no AI-generated people image or people disclaimer', (_profile, markup) => {
    const html = markup();
    for (const src of aiPeopleSources) expect(html, src).not.toContain(src);
    expect(html).not.toContain('AI-generated illustration');
    expect(html).not.toContain('not Constructa staff');
    expect(html).not.toContain('not Robert Smith');
  });

  it.each([
    ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
    ['full', () => renderToStaticMarkup(<FullAboutPage />)],
  ])('%s uses non-people illustrations for the hero and problem panels', (_profile, markup) => {
    const html = markup();
    const findImg = (key: string) => html.match(new RegExp(`<img[^>]*src="[^"]*${key}[^"]*"[^>]*>`, 'i'))?.[0] ?? '';
    for (const [key, src] of [['minimalist infographic cluster', heroSource], ['spreadsheet grid and warning', problemSource]]) {
      const img = findImg(key);
      expect(img, src).toContain('data-next-image="true"');
      expect(img).not.toMatch(/alt="[^"]*(people|person|colleagues|staff|man |woman )/i);
    }
    expect(html).toContain('Illustration of a cluster of small construction buildings');
    expect(html).toContain('Illustration of a spreadsheet grid with warning and error symbols');
  });

  it.each([
    ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
    ['full', () => renderToStaticMarkup(<FullAboutPage />)],
  ])('%s keeps the founder quote without a portrait figure', (_profile, markup) => {
    const html = markup();
    expect(html).toContain('A message from the founder');
    expect(html).toContain('— Robert Smith');
    const founderSection = html.split('A message from the founder')[1] ?? '';
    expect(founderSection.split('Why now?')[0]).not.toContain('<img');
  });

  it.each([
    ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
    ['full', () => renderToStaticMarkup(<FullAboutPage />)],
  ])('%s captions the real review capture as a synthetic journey fixture', (_profile, markup) => {
    const html = markup();
    expect(html).toContain('/docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-1440x900.jpg');
    expect(html).toContain('synthetic journey fixture capture from 15 November 2026');
    expect(html).toContain('made-up job');
    expect(html).toContain('simulated saves');
    expect(html).toContain('Price adjustments panel');
  });

  it('keeps committed public PNGs for the used illustrations', () => {
    for (const src of [heroSource, problemSource]) {
      const bytes = readFileSync(`public${src}`);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});
