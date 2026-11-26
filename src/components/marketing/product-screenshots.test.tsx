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
  ['docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-1440x900.jpg', 'effe3af0316d58d4461080f8bda88f0b3678b3ed'],
  ['docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-390x844.jpg', '036872b525a146177800cf1387ce08dc75d54fe4'],
  ['docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-1440x900.jpg', '27b071871edab8a7336d1426d25061257d2b5eb7'],
  ['docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-390x844.jpg', 'dbb47364cc6f40989839e3cdb9540e24d74799ad'],
] as const;
const pictures = () => html().match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
const srcset = (tag: string) => decodeURIComponent(tag.match(/srcset="([^"]+)"/i)?.[1] ?? '');

describe('phase-one product screenshots', () => {
  it('sits on the features view after the review guide, exactly once, with no repeated scope block', () => {
    const page = renderToStaticMarkup(<PhaseOneFeatures />);
    const [guide, shots, scope] = ['id="product-review-guide"', MARKER, 'id="phase-one"'].map(marker => page.indexOf(marker));
    expect(guide).toBeGreaterThan(-1);
    expect(shots).toBeGreaterThan(guide);
    expect(scope).toBe(-1);
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
      expect(image).toContain('width="1440"');
      expect(image).toContain('height="900"');
      expect(image).toContain('sizes=');
      expect(image).toMatch(/alt="Constructa [^"]{120,}"/);
      expect(image).not.toMatch(/src="https?:/);
    }
    expect(images[0]).toContain('Price adjustments');
    expect(images[1]).toContain('Strip out');
  });

  it('swaps each figure to its own phone capture through a declarative narrow source', () => {
    const pairs = [
      ['01-estimate-price-adjustments-390x844.jpg', '01-estimate-price-adjustments-1440x900.jpg'],
      ['02-programme-saved-stages-390x844.jpg', '02-programme-saved-stages-1440x900.jpg'],
    ];
    expect(pictures()).toHaveLength(2);
    pictures().forEach((picture, index) => {
      const [phone, desktop] = pairs[index];
      const sources = picture.match(/<source\b[^>]*>/g) ?? [];
      const image = picture.match(/<img\b[^>]*>/)?.[0] ?? '';
      expect(sources).toHaveLength(1);
      expect(picture.indexOf('<source')).toBeLessThan(picture.indexOf('<img'));
      expect(sources[0]).toContain('media="(max-width: 600px)"');
      expect(sources[0]).toContain('sizes="88vw"');
      expect(sources[0]).toContain('width="390"');
      expect(sources[0]).toContain('height="844"');
      expect(srcset(sources[0]!)).toContain(phone);
      expect(srcset(sources[0]!)).not.toContain(desktop);
      expect(srcset(image)).toContain(desktop);
      expect(srcset(image)).not.toContain(phone);
      expect(image).toContain('loading="lazy"');
    });
  });

  it('keeps alt text true of both the desktop and the shorter phone view', () => {
    const alts = (html().match(/<img\b[^>]*>/g) ?? []).map(image => image.match(/alt="([^"]+)"/)?.[1] ?? '');
    expect(alts).toHaveLength(2);
    expect(alts[0]).toContain('overhead');
    expect(alts[0]).toContain('risk');
    expect(alts[1]).toContain('Strip out');
    expect(alts[1]).toContain('First fix');
  });

  it('states the section qualification in visible text', () => {
    const visible = html().replace(/<img\b[^>]*>/g, '');
    for (const fact of [
      'These screens show the product with sample data from a synthetic journey fixture, captured on 15 November 2026 with simulated saving.',
      'Live signup, email and production saving require separate verification.',
      'Controls may change before release.',
      'Example screens',
      'From the current review interface.',
    ]) expect(visible).toContain(fact);
  });

  it('dates and qualifies each figure in its own caption', () => {
    const captions = html().match(/<figcaption[\s\S]*?<\/figcaption>/g) ?? [];
    for (const caption of captions) expect(caption).toMatch(/<time datetime="2026-11-15">15 November 2026<\/time>/i);
    for (const caption of captions) for (const label of ['Example screen', 'Sample data', 'Simulated saving']) expect(caption).toContain(label);
    expect(captions[0]).toContain('They are not prices, typical margins or a quote.');
    expect(captions[1]).toContain('not a standard programme or a promise of how long any job takes');
  });

  it('turns no sample figure into a price or duration claim and adds no availability claim', () => {
    const text = html().replace(/<picture>[\s\S]*?<\/picture>/g, '');
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

  it('frames each capture in a device chrome with a neutral window label', () => {
    expect(html().match(/class="[^"]*frameBar[^"]*"/g)).toHaveLength(2);
    expect(html().match(/Constructa review interface/g)).toHaveLength(2);
    for (const label of ['Price adjustments', 'programme at a glance']) {
      expect(html()).toContain(label);
    }
  });

  it('notes the zoomed desktop view and the full-length small-screen view in each caption', () => {
    const captions = html().match(/<figcaption[\s\S]*?<\/figcaption>/g) ?? [];
    for (const caption of captions) {
      expect(caption).toMatch(/larger screens/i);
      expect(caption).toMatch(/smaller screens show the full(?:-length)? capture/i);
    }
    expect(captions[0]).toContain('running total, price adjustments and save control');
    expect(captions[1]).toContain('programme at a glance');
  });

  it('zooms each desktop capture into its readable band only on larger screens', () => {
    const styles = source('./product-screenshots.module.css');
    expect(styles).toContain('@media (min-width: 601px)');
    expect(styles).toContain('.zoomEstimate img { transform: translateY(-34%); }');
    expect(styles).toContain('.zoomProgramme img { transform: translateY(-26%) scale(1.45); }');
    expect(styles).toContain('overflow: hidden');
    expect(styles).not.toContain('@media (max-width: 600px)');
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
