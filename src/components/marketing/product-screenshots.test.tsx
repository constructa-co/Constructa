import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PhaseOneFeatures, PhaseOneHome, PhaseOnePricing } from './phase-one';
import { ProductScreenshots } from './product-screenshots';
import Home from '@/app/page';
import Pricing from '@/app/pricing/page';
import Features from '@/app/features/page';
import Product from '@/app/product/page';

vi.mock('next/navigation', () => ({ usePathname: () => '/features', useRouter: () => ({}) }));

afterEach(() => { vi.unstubAllEnvs(); });

const MARKER = 'id="product-screenshots"';
const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = () => renderToStaticMarkup(<ProductScreenshots />);
const assets = [
  ['docs/evidence/stage2-tranche-2c/18b-estimate-price-adjustments-preview-1280x800.jpg', '2c3e96d85808740883ce037d7f643b6fedd1edf0'],
  ['docs/evidence/stage2-tranche-2d/04-programme-four-stages-editor-1280x800.jpg', 'bf1fdf6646344a6aaf50806bc851439e13c462c9'],
] as const;

describe('phase-one product screenshots', () => {
  it('sits on the features view after the review guide and before the scope, exactly once', () => {
    const page = renderToStaticMarkup(<PhaseOneFeatures />);
    const [guide, shots, scope] = ['id="product-review-guide"', MARKER, 'id="phase-one"'].map(marker => page.indexOf(marker));
    expect(guide).toBeGreaterThan(-1);
    expect(shots).toBeGreaterThan(guide);
    expect(scope).toBeGreaterThan(shots);
    expect(page.match(new RegExp(MARKER, 'g'))).toHaveLength(1);
  });

  it('follows the cohort features routes and stays off home, pricing and the full profile', () => {
    for (const Page of [PhaseOneHome, PhaseOnePricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(MARKER);
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    for (const Page of [Features, Product]) expect(renderToStaticMarkup(<Page />)).toContain(MARKER);
    for (const Page of [Home, Pricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(MARKER);
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    for (const Page of [Features, Product]) expect(renderToStaticMarkup(<Page />)).not.toContain(MARKER);
  });

  it('renders two figures from the local assets with intrinsic sizes and descriptive alt text', () => {
    const images = html().match(/<img\b[^>]*>/g) ?? [];
    expect(html().match(/<figure\b/g)).toHaveLength(2);
    expect(html().match(/<figcaption\b/g)).toHaveLength(2);
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toContain('width="1280"');
      expect(image).toContain('height="800"');
      expect(image).toContain('sizes=');
      expect(image).toMatch(/alt="Earlier Constructa [^"]{120,}"/);
      expect(image).not.toMatch(/src="https?:/);
    }
    expect(images[0]).toContain('Save adjustments');
    expect(images[1]).toContain('Strip out');
  });

  it('states the section qualification in visible text', () => {
    const visible = html().replace(/<img\b[^>]*>/g, '');
    for (const fact of [
      'synthetic example component captures from 3 and 4 October 2026',
      'an earlier interface',
      'mocked persistence',
      'They are not the current hosted interface.',
      'They are not proof that saving, AI, email or customer use is available.',
      'do not show the current look',
    ]) expect(visible).toContain(fact);
  });

  it('dates and qualifies each figure in its own caption', () => {
    const captions = html().match(/<figcaption[\s\S]*?<\/figcaption>/g) ?? [];
    expect(captions[0]).toMatch(/<time datetime="2026-10-03">3 October 2026<\/time>/i);
    expect(captions[1]).toMatch(/<time datetime="2026-10-04">4 October 2026<\/time>/i);
    for (const caption of captions) for (const label of ['Synthetic example component capture', 'Earlier interface', 'Mocked persistence']) expect(caption).toContain(label);
    expect(captions[0]).toContain('They are not prices, typical margins or a quote.');
    expect(captions[1]).toContain('not a standard programme or a promise of how long any job takes');
  });

  it('turns no sample figure into a price or duration claim and adds no availability claim', () => {
    const text = html();
    expect(text).not.toMatch(/£|\b\d+\s*(%|working days?|weeks?)\b/i);
    expect(text).not.toMatch(/\b(AI-powered|AI-generated|sign up now|get started|now available|available now|free trial|GDPR compliant|ISO 27001|SOC 2|Cyber Essentials|certified)\b/i);
    expect(text).not.toMatch(/Stripe|Paddle|Formspree|Plausible|OpenAI|Resend|Supabase|Vercel/);
  });

  it('adds no control, carousel, modal or link', () => {
    expect(html()).not.toMatch(/<a\b|<button|<form|<input|<select|<textarea|<dialog|<script|<iframe|tabindex=|role="dialog"/i);
  });

  it('keeps an accessible heading order inside the section', () => {
    const levels = [...html().matchAll(/<h([1-6])\b/g)].map(match => Number(match[1]));
    expect(levels).toEqual([2, 3, 3]);
    expect(html()).toContain('aria-labelledby="product-screenshots-title"');
    expect(html()).toContain('<h2 id="product-screenshots-title">');
  });

  it('imports the unchanged committed evidence images rather than copies', () => {
    const component = source('./product-screenshots.tsx');
    for (const [path, blob] of assets) {
      expect(component).toContain(`from '../../../${path}'`);
      const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
      expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(blob);
    }
    expect(component).not.toMatch(/\/public\/|https?:|\/images\//);
  });

  it('adds no data transmission, client state, gate or remote style', () => {
    const component = source('./product-screenshots.tsx');
    const styles = source('./product-screenshots.module.css');
    expect(component).not.toMatch(/fetch\(|process\.env|getLaunchProfile|isCapabilityEnabled|use client|useState|localStorage|sendBeacon/);
    expect(styles).not.toMatch(/url\(|@import|https?:|filter|object-fit|aspect-ratio|clip-path|mix-blend/);
    expect(styles.match(/font-size:\s*(\d+)px/g)?.every(size => parseInt(size.replace(/\D/g, ''), 10) >= 14)).toBe(true);
  });
});
