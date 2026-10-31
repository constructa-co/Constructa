import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PhaseOneFeatures, PhaseOneHome, PhaseOnePricing } from './phase-one';
import { ProductReviewGuide } from './product-review-guide';
import Home from '@/app/page';
import Pricing from '@/app/pricing/page';
import Features from '@/app/features/page';
import Product from '@/app/product/page';

vi.mock('next/navigation', () => ({ usePathname: () => '/features', useRouter: () => ({}) }));

afterEach(() => { vi.unstubAllEnvs(); });

const GUIDE_MARKER = 'id="product-review-guide"';
const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const guideHtml = () => renderToStaticMarkup(<ProductReviewGuide />);
const heldList = () => guideHtml().match(/Held back from this preview[\s\S]*?<\/ul>/)?.[0] ?? '';

describe('phase-one product review guide', () => {
  it('sits inside the real features page, directly after the journey and before the scope', () => {
    const html = renderToStaticMarkup(<PhaseOneFeatures />);
    const [journey, guide, scope] = ['id="how-it-works"', GUIDE_MARKER, 'id="phase-one"'].map(marker => html.indexOf(marker));
    expect(journey).toBeGreaterThan(-1);
    expect(guide).toBeGreaterThan(journey);
    expect(scope).toBeGreaterThan(guide);
    expect(html.match(new RegExp(GUIDE_MARKER, 'g'))).toHaveLength(1);
  });

  it('stays off the home and pricing pages', () => {
    for (const Page of [PhaseOneHome, PhaseOnePricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(GUIDE_MARKER);
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    for (const Page of [Home, Pricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(GUIDE_MARKER);
  });

  it('follows the cohort default on the routes that render PhaseOneFeatures, and never the full profile', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    for (const Page of [Features, Product]) expect(renderToStaticMarkup(<Page />)).toContain(GUIDE_MARKER);
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    for (const Page of [Features, Product]) expect(renderToStaticMarkup(<Page />)).not.toContain(GUIDE_MARKER);
  });

  it('gives every step in the connected journey an input, an output and a review boundary', () => {
    const html = guideHtml();
    for (const step of ['Company', 'Brief and price', 'Programme', 'Proposal']) expect(html).toContain(`<h3>${step}</h3>`);
    for (const label of ['You add', 'You get', 'Check before sharing']) expect(html.match(new RegExp(`<dt>${label}</dt>`, 'g'))).toHaveLength(4);
    for (const fact of ['One-price items, quantities and rates', 'working days from Day 1', 'A PDF marked as a draft. Downloading it sends nothing', 'non-binding intention to proceed, and neither is acceptance']) expect(html).toContain(fact);
  });

  it('labels the section with an accessible heading and an unbroken heading order', () => {
    const html = guideHtml();
    expect(html).toContain('aria-labelledby="product-review-guide-title"');
    expect(html).toContain('<h2 id="product-review-guide-title">');
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map(match => Number(match[1]));
    expect(levels[0]).toBe(2);
    expect(levels.slice(1).every(level => level === 3)).toBe(true);
    expect(levels).toHaveLength(8);
    expect((html.match(/<svg\b[^>]*>/g) ?? []).every(icon => icon.includes('aria-hidden="true"'))).toBe(true);
  });

  it('links visitors only to the existing sign-in and preview-access pages', () => {
    const html = guideHtml();
    expect([...html.matchAll(/href="([^"]*)"/g)].map(match => match[1])).toEqual(['/login', '/pricing']);
    expect(html).toContain('Sign in to Constructa');
    expect(html).toContain('How preview access works');
    expect(html).toContain('Already have a review account?');
    expect(html).toContain('No account yet?');
  });

  it('separates what can be reviewed from what is held back', () => {
    const html = guideHtml();
    expect(html.indexOf('What you can review')).toBeGreaterThan(-1);
    expect(html.indexOf('Held back from this preview')).toBeGreaterThan(html.indexOf('What you can review'));
    for (const item of ['Live AI assistance', 'New account sign-up', 'Release for real customers and live jobs', 'Checkout, subscriptions and payment', 'Complete photo, consent and recovery journeys', 'Security certification. None is claimed']) expect(heldList()).toContain(item);
  });

  it('does not claim availability, invent commercial facts or add a processor', () => {
    const html = guideHtml();
    expect(html).not.toMatch(/£|\bfree trial\b|\bdiscount\b|\bsave \d|%|testimonial|<blockquote/i);
    expect(html).not.toMatch(/\b(AI-powered|AI-generated|sign up now|get started|now available|available now|GDPR compliant|ISO 27001|SOC 2|Cyber Essentials|certified)\b/i);
    expect(html).not.toMatch(/<form|<input|<button|<textarea|<select|<script|<iframe|<img/i);
    expect(html).not.toMatch(/checkout"|Stripe|Paddle|Formspree|Plausible|Google Analytics|OpenAI|Resend|Supabase|Vercel/i);
  });

  it('adds no data transmission, gate flip or shared-style change in source', () => {
    const component = source('./product-review-guide.tsx');
    const styles = source('./product-review-guide.module.css');
    expect(component).not.toMatch(/fetch\(|process\.env|getLaunchProfile|isCapabilityEnabled|use client|useState|localStorage|sendBeacon/);
    expect(styles).not.toMatch(/url\(|@import|https?:/);
    expect(styles.match(/font-size:\s*(\d+)px/g)?.every(size => parseInt(size.replace(/\D/g, ''), 10) >= 12)).toBe(true);
    const phaseOne = source('./phase-one.tsx');
    expect(phaseOne.match(/<ProductReviewGuide \/>/g)).toHaveLength(1);
    const features = phaseOne.match(/export function PhaseOneFeatures[\s\S]*?\n}/)?.[0] ?? '';
    expect(features).toContain('<ProductReviewGuide />');
  });
});
