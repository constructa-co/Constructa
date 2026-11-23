import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhaseOneAbout } from './cohort-about';
import { FullAboutPage } from './full-about';
import {
  aboutCaptures,
  removedUnverifiedIllustrations,
} from './about-image-provenance';

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

const renderers = [
  ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
  ['full', () => renderToStaticMarkup(<FullAboutPage />)],
] as const;

function sectionContaining(html: string, text: string) {
  const match = html.match(new RegExp(`<section\\b[^>]*>(?:(?!</section>).)*${text}(?:(?!</section>).)*</section>`, 'is'));
  expect(match?.[0], `section containing: ${text}`).toBeTruthy();
  return match?.[0] ?? '';
}

describe('About illustration panels without AI-generated people (cohort + full)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(renderers)('%s renders no AI-generated people image or people disclaimer', (_profile, markup) => {
    const html = markup();
    for (const src of aiPeopleSources) expect(html, src).not.toContain(src);
    expect(html).not.toContain('AI-generated illustration');
    expect(html).not.toContain('not Constructa staff');
    expect(html).not.toContain('not Robert Smith');
  });

  it.each(renderers)('%s references none of the removed unverified illustrations (#191)', (_profile, markup) => {
    const html = markup();
    for (const { src } of removedUnverifiedIllustrations) expect(html, src).not.toContain(src);
    expect(html).not.toContain('Illustration of a cluster of small construction buildings');
    expect(html).not.toContain('Illustration of a spreadsheet grid with warning and error symbols');
  });

  it.each(renderers)(
    '%s shows the verified programme capture in the built-by panel with its synthetic disclosure',
    (_profile, markup) => {
      const html = markup();
      const panel = sectionContaining(html, 'Built around your own judgement');
      expect(panel).toContain(aboutCaptures.programmeSavedStages.sourcePath);
      expect(panel).toContain('synthetic journey fixture capture from 15 November 2026');
      expect(panel).toContain('made-up job');
      expect(panel).toContain('simulated saves');
      expect(panel).toContain('saved stages named Strip out and First fix');
      expect(panel).toMatch(/data-next-image="true"/);
    },
  );

  it.each(renderers)('%s keeps the problem panel text-only with no image', (_profile, markup) => {
    const html = markup();
    const panel = sectionContaining(html, 'The problem we saw');
    expect(panel).toContain('Proposals get rushed');
    expect(panel).not.toContain('<img');
    expect(panel).not.toContain('data-next-image');
  });

  it.each(renderers)('%s excludes unsupported founder history and attributed quotes', (_profile, markup) => {
    const html = markup();
    expect(html).not.toContain('A message from the founder');
    expect(html).not.toContain('— Robert Smith');
    expect(html).not.toMatch(/25 years|spent decades/);
  });

  it.each(renderers)('%s captions the real review capture as a synthetic journey fixture', (_profile, markup) => {
    const html = markup();
    expect(html).toContain(aboutCaptures.estimatePriceAdjustments.sourcePath);
    expect(html).toContain('synthetic journey fixture capture from 15 November 2026');
    expect(html).toContain('made-up job');
    expect(html).toContain('simulated saves');
    expect(html).toContain('Price adjustments panel');
  });

  it.each(renderers)(
    '%s renders only provenance-registered imagery',
    (_profile, markup) => {
      const html = markup();
      const registeredSources = [
        ...Object.values(aboutCaptures).map((capture) => capture.sourcePath),
      ];
      const imgSrcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1]);
      expect(imgSrcs.length).toBe(2);
      for (const src of imgSrcs) {
        expect(
          registeredSources.some((registered) => src.includes(registered)),
          `unregistered image src: ${src}`,
        ).toBe(true);
      }
    },
  );

  it('keeps the removed illustration files on disk without referencing them', () => {
    for (const { src } of removedUnverifiedIllustrations) {
      const bytes = readFileSync(`public${src}`);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});
