import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhaseOneAbout } from './cohort-about';
import { FullAboutPage } from './full-about';

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; width?: number; height?: number; className?: string }) => (
    <img
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
      className={props.className}
      data-next-image="true"
    />
  ),
}));

const captionedSources = [
  {
    src: '/images/about-hero.png',
    caption: 'AI-generated illustration. The people shown are not Constructa staff or clients.',
    width: '2048',
    height: '2048',
  },
  {
    src: '/images/founder-message.png',
    caption: 'AI-generated illustration. The person shown is not Robert Smith.',
    width: '1024',
    height: '1024',
  },
] as const;

describe('About captioned illustration panels (cohort + full)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['cohort', () => renderToStaticMarkup(<PhaseOneAbout />)],
    ['full', () => renderToStaticMarkup(<FullAboutPage />)],
  ])('%s exposes captioned hero and founder images with figure styling', (_profile, markup) => {
    const html = markup();
    for (const { src, caption, width, height } of captionedSources) {
      expect(html).toContain(caption);
      const img = html.match(new RegExp(`<img[^>]*src="${src.replace('/', '\\/')}"[^>]*>`, 'i'))?.[0] ?? '';
      expect(img, caption).toContain('data-next-image="true"');
      expect(img).toContain(`width="${width}"`);
      expect(img).toContain(`height="${height}"`);
      expect(cohortOrFullHasFigureClass(html, src), src).toBe(true);
    }
  });

  it('keeps the original problem illustration path', () => {
    const html = renderToStaticMarkup(<PhaseOneAbout />);
    expect(html).toContain('/images/about-problem1.png');
    expect(html).not.toContain('/images/about-problem.png');
  });

  it('keeps committed public PNGs for captioned panels', () => {
    for (const { src } of captionedSources) {
      const bytes = readFileSync(`public${src}`);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});

function cohortOrFullHasFigureClass(html: string, src: string) {
  const img = html.match(new RegExp(`<img[^>]*src="${src.replace('/', '\\/')}"[^>]*>`, 'i'))?.[0] ?? '';
  return src === '/images/about-hero.png' ? /class="/.test(img) : /class="w-full h-auto/.test(img) || /class="/.test(img);
}