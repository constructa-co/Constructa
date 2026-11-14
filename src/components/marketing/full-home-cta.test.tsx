import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FullMarketingPage from './full-home';

vi.mock('next/image', () => ({
  default: (props: { id?: string; alt?: string }) => (
    <img id={props.id} alt={props.alt} />
  ),
}));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('@/app/components/FAQ', () => ({ default: () => null }));
vi.mock('@/components/marketing/project-cover-render', () => ({
  ProjectCoverRender: () => null,
}));

describe('full marketing home CTAs', () => {
  it('routes Try Constructa and hero Get Started links to /apply instead of dead anchors', () => {
    const html = renderToStaticMarkup(<FullMarketingPage />);
    expect(readFileSync(new URL('./full-home.tsx', import.meta.url), 'utf8')).toContain(
      'src="/feature-scroll.js"',
    );
    for (const id of [
      'try-constructa-proposals',
      'try-constructa-planning',
      'try-constructa-updates',
      'try-constructa-cost-control',
      'try-constructa-solution',
      'try-constructa-apart',
      'try-constructa-how-it-works',
      'try-constructa-about',
    ]) {
      const tag = html.match(new RegExp(`<a\\b[^>]*id="${id}"[^>]*>`))?.[0] ?? '';
      expect(tag).toContain('href="/apply"');
    }
    expect(html).toMatch(/href="\/apply"[^>]*>\s*Get Started Free/);
    expect(html).not.toMatch(/id="try-constructa-[^"]+"[^>]*href="#"/);
  });
});