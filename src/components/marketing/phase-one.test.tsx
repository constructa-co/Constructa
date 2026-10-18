import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PhaseOneHome, PhaseOnePricing, PhaseOneFeatures, MarketingHeader, MarketingFooter } from './phase-one';
import Home from '@/app/page';
import Landing from '@/app/landing/page';
import Pricing from '@/app/pricing/page';
import Features from '@/app/features/page';
import Product from '@/app/product/page';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FirstSessionFrame } from '@/components/first-session-frame';
import PublicChrome from '@/components/public-chrome';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({}) }));

afterEach(() => { vi.unstubAllEnvs(); route.pathname = '/'; });

describe('phase-one marketing integration', () => {
  it('introduces the complete work-winning journey without an add-on sales form', () => {
    const html = renderToStaticMarkup(<PhaseOneHome />);
    expect(html).toContain('Good work.');
    for (const label of ['Make it your business.', 'Put a price to the work.', 'Give the job a plan.', 'Present the whole picture.']) expect(html).toContain(label);
    expect(html).toContain('href="/login"');
    expect(html).toContain('id="how-it-works"');
    expect(html).toContain('id="marketing-content"');
    expect(html).toContain('Illustrative example');
    expect(html).not.toMatch(/<form|<script|<iframe|href="[^\"]*checkout|Paddle|Formspree/i);
  });

  it('keeps chatbot and release limitations explicit', () => {
    const html = renderToStaticMarkup(<PhaseOneFeatures />);
    expect(html).toContain('not available as a live chatbot');
    expect(html).toContain('need release verification');
    expect(html).not.toContain('24/7');
    expect(html).not.toContain('AI-powered construction management');
  });

  it('does not invent a price, free trial, payment link or paid entitlement', () => {
    const html = renderToStaticMarkup(<PhaseOnePricing />);
    expect(html).toContain('does not sell a subscription');
    expect(html).not.toMatch(/£|<form|<button|href="https?:/);
    expect(html).not.toContain('14-day');
  });

  it.each([['home', Home], ['landing', Landing], ['pricing', Pricing], ['features', Features], ['product', Product]] as const)('uses phase-one content on the %s route by default', (_name, Page) => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Enterprise');
    expect(html).not.toContain('Get Started for free');
    expect(html).not.toContain('Real-time Cost Updates');
  });

  it.each([['home', Home, 'Get Started Free'], ['landing', Landing, 'Join the waitlist'], ['pricing', Pricing, 'Enterprise'], ['features', Features, 'Real-time Cost Updates'], ['product', Product, 'Deliver it']] as const)('retains the original %s view under the existing full profile', (_name, Page, marker) => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain(marker);
    expect(html).not.toContain('not available as a live chatbot');
  });

  it('keeps public navigation within the phase-one scope', () => {
    const html = renderToStaticMarkup(<><MarketingHeader /><MarketingFooter /></>);
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/privacy-policy"');
    expect(html).toContain('href="/terms-of-service"');
    expect(html).not.toContain('/dashboard/resources');
    expect(html).not.toContain('FeatureDropdown');
  });

  it('selects the same public header and footer while retaining full-profile navigation', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    expect(renderToStaticMarkup(<Header />)).toContain('How it works');
    expect(renderToStaticMarkup(<Footer />)).toContain('Phase one review');
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    expect(renderToStaticMarkup(<Header />)).toContain('Pricing');
    expect(renderToStaticMarkup(<Footer />)).toContain('Customers');
  });

  it('keeps the account wordmark free of the rejected full stop', () => {
    const html = renderToStaticMarkup(<FirstSessionFrame><p>Account</p></FirstSessionFrame>);
    expect(html).toContain('constructa');
    expect(html).not.toContain('brandDot');
  });

  it('rewrites only the public homepage, never login/auth/app paths', () => {
    const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
    expect(config.rewrites).toHaveLength(2);
    expect(config.rewrites.every((rule: { source: string; destination: string }) => rule.source === '/' && rule.destination === '/landing')).toBe(true);
    expect(config.crons).toEqual([{ path: '/api/cron/contract-alerts', schedule: '0 7 * * *' }]);
  });

  it.each(['/login', '/onboarding', '/auth/confirm', '/dashboard', '/dashboard/settings/profile', '/admin', '/proposal/example'])('keeps public marketing chrome off %s', pathname => {
    route.pathname = pathname;
    const html = renderToStaticMarkup(<PublicChrome><p>Existing page</p></PublicChrome>);
    expect(html).toContain('Existing page');
    expect(html).not.toContain('Main navigation');
    expect(html).not.toContain('Footer navigation');
  });

  it('restores both marketing landmarks after returning from account entry without a reload', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    route.pathname = '/login';
    expect(renderToStaticMarkup(<PublicChrome><p>Account</p></PublicChrome>)).not.toContain('Main navigation');
    route.pathname = '/';
    const html = renderToStaticMarkup(<PublicChrome><PhaseOneHome /></PublicChrome>);
    expect(html).toContain('Main navigation');
    expect(html).toContain('Footer navigation');
  });

  it('keeps the full landing footer self-contained but supplies the cohort landing footer', () => {
    route.pathname = '/landing';
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    expect(renderToStaticMarkup(<PublicChrome><p>Landing</p></PublicChrome>)).not.toContain('<footer');
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    expect(renderToStaticMarkup(<PublicChrome><p>Landing</p></PublicChrome>)).toContain('Footer navigation');
  });
});
