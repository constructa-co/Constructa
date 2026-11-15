import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PhaseOneAbout } from './cohort-about';

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

const panelSources = [
  ['/images/about-problem.png', 'The problem we saw'],
  ['/images/about-solution.png', 'The solution we'],
] as const;

describe('cohort About illustration panels', () => {
  it('references the landscape problem asset and applies figureImage on both split panels', () => {
    const html = renderToStaticMarkup(<PhaseOneAbout />);
    for (const [src, heading] of panelSources) {
      expect(html.indexOf(heading)).toBeGreaterThan(-1);
      const img = html.match(new RegExp(`<img[^>]*src="${src.replace('/', '\\/')}"[^>]*>`, 'i'))?.[0] ?? '';
      expect(img, heading).toContain('data-next-image="true"');
      expect(img).toMatch(/class="/);
      expect(img).toMatch(/width="\d+"/);
      expect(img).toMatch(/height="\d+"/);
    }
    expect(html).not.toContain('/images/about-problem1.png');
  });

  it('keeps committed public PNGs for the problem and solution panels', () => {
    for (const [src] of panelSources) {
      const bytes = readFileSync(`public${src}`);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});