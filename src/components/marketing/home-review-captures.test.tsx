import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { HomeReviewCaptures } from './home-review-captures';
import { PhaseOneFeatures, PhaseOneHome, PhaseOnePricing } from './phase-one';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({}) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

const MARKER = 'id="review-captures"';
const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = () => renderToStaticMarkup(<HomeReviewCaptures />);

describe('home review captures (CON-051)', () => {
  it('sits on the cohort home after the how-it-works journey, exactly once', () => {
    const page = renderToStaticMarkup(<PhaseOneHome />);
    const [journey, captures] = ['id="how-it-works"', MARKER].map(marker => page.indexOf(marker));
    expect(journey).toBeGreaterThan(-1);
    expect(captures).toBeGreaterThan(journey);
    expect(page.match(new RegExp(MARKER, 'g'))).toHaveLength(1);
  });

  it('stays off the features, pricing and full-profile views', () => {
    for (const Page of [PhaseOneFeatures, PhaseOnePricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(MARKER);
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    for (const Page of [PhaseOneFeatures, PhaseOnePricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(MARKER);
  });

  it('renders two figures from the shared captures with intrinsic sizes and descriptive alt text', () => {
    const images = html().match(/<img\b[^>]*>/g) ?? [];
    expect(html().match(/<figure\b/g)).toHaveLength(2);
    expect(html().match(/<figcaption\b/g)).toHaveLength(2);
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toContain('width="1440"');
      expect(image).toContain('height="900"');
      expect(image).toMatch(/alt="Constructa [^"]{120,}"/);
      expect(image).not.toMatch(/src="https?:/);
    }
  });

  it('keeps the synthetic-journey disclosure in the qualification and both figure captions', () => {
    const visible = html().replace(/<img\b[^>]*>/g, '');
    expect(visible).toContain('synthetic journey fixture captures from 15 November 2026');
    expect(visible).toContain('made-up data and simulated saves');
    expect(visible).toContain('Live signup, email and production saving require separate verification.');
    const captions = html().match(/<figcaption[\s\S]*?<\/figcaption>/g) ?? [];
    expect(captions).toHaveLength(2);
    for (const caption of captions) {
      expect(caption).toContain('Synthetic journey fixture capture');
      expect(caption).toMatch(/<time datetime="2026-11-15">15 November 2026<\/time>/i);
      expect(caption).toContain('Simulated saves');
    }
  });

  it('makes no price, duration or availability claim and names no provider', () => {
    const text = html().replace(/<picture>[\s\S]*?<\/picture>/g, '');
    expect(text).not.toMatch(/£|\bfrom £/i);
    expect(text).not.toMatch(/\b(now available|available now|free trial|sign up now|GDPR compliant|ISO 27001|SOC 2)\b/i);
    expect(text).not.toMatch(/Stripe|Paddle|Formspree|Plausible|OpenAI|Resend|Supabase|Vercel/);
  });

  it('adds no control, carousel, modal or link', () => {
    expect(html()).not.toMatch(/<a\b|<button|<form|<input|<select|<textarea|<dialog|<script|<iframe|tabindex=|role="dialog"/i);
  });

  it('keeps an accessible heading order inside the section', () => {
    const levels = [...html().matchAll(/<h([1-6])\b/g)].map(match => Number(match[1]));
    expect(levels).toEqual([2, 3, 3]);
    expect(html()).toContain('aria-labelledby="review-captures-title"');
    expect(html()).toContain('<h2 id="review-captures-title">');
  });

  it('reuses the shared committed captures instead of copies or public images', () => {
    const component = source('./home-review-captures.tsx');
    expect(component).toContain("from './product-screenshots'");
    expect(component).not.toMatch(/\/public\/|https?:|\/images\//);
    const shared = source('./product-screenshots.tsx');
    expect(shared).toContain('export const captures');
    expect(shared).toContain('export function CapturePicture');
  });
});
