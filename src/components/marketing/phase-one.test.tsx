import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PhaseOneHome, PhaseOnePricing, PhaseOneFeatures, MarketingHeader, MarketingFooter } from './phase-one';
import { MarketingMobileMenu, closeMobileMenu } from './marketing-mobile-menu';
import Home from '@/app/page';
import Landing from '@/app/landing/page';
import Pricing from '@/app/pricing/page';
import Features from '@/app/features/page';
import Product from '@/app/product/page';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FirstSessionFrame } from '@/components/first-session-frame';
import PublicChrome from '@/components/public-chrome';
import ui from './phase-one.module.css';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({}) }));

afterEach(() => { vi.unstubAllEnvs(); route.pathname = '/'; });

describe('phase-one marketing integration', () => {
  it('simplifies phase-one navigation to Product, Preview access, About and Guides', () => {
    const html = renderToStaticMarkup(<MarketingHeader />);
    expect(html).toContain('href="/features">Product</a>');
    expect(html).toContain('href="/about">About</a>');
    expect(html).toContain('href="/guides">Guides</a>');
    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).not.toContain('How it works');
    expect(html).not.toContain('Pricing');
    // Main and mobile navigation both keep the /pricing destination under the Preview access label.
    expect(html.match(/href="\/pricing">Preview access<\/a>/g) ?? []).toHaveLength(2);
  });

  it('renders the mobile menu closed with the same destinations plus sign-in', () => {
    const html = renderToStaticMarkup(<MarketingMobileMenu />);
    expect(html).toMatch(/^<details\b(?![^>]*\bopen\b)[^>]*><summary>Menu<\/summary>/);
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(match => [match[1], match[2]]);
    expect(links).toEqual([['/features', 'Product'], ['/pricing', 'Preview access'], ['/about', 'About'], ['/guides', 'Guides'], ['/login', 'Sign in']]);
  });

  it('closes the open mobile menu on selection without moving focus', () => {
    const summary = { focus: vi.fn() };
    const menu = { open: true, contains: vi.fn(() => false), querySelector: vi.fn(() => summary) };
    expect(closeMobileMenu(menu as unknown as HTMLDetailsElement)).toBe(true);
    expect(menu.open).toBe(false);
    expect(summary.focus).not.toHaveBeenCalled();
  });

  it('closes the open mobile menu on Escape and returns focus from a hidden link to the Menu control', () => {
    const summary = { focus: vi.fn() };
    const inside = {} as Node;
    const menu = { open: true, contains: vi.fn((node: Node) => node === inside), querySelector: vi.fn(() => summary) };
    expect(closeMobileMenu(menu as unknown as HTMLDetailsElement, inside)).toBe(true);
    expect(menu.open).toBe(false);
    expect(menu.querySelector).toHaveBeenCalledWith('summary');
    expect(summary.focus).toHaveBeenCalledTimes(1);

    menu.open = true;
    expect(closeMobileMenu(menu as unknown as HTMLDetailsElement, {} as Node)).toBe(true);
    expect(summary.focus).toHaveBeenCalledTimes(1);
  });

  it('leaves a closed or unmounted mobile menu alone', () => {
    const menu = { open: false, contains: vi.fn(), querySelector: vi.fn() };
    expect(closeMobileMenu(menu as unknown as HTMLDetailsElement, {} as Node)).toBe(false);
    expect(closeMobileMenu(null)).toBe(false);
    expect(menu.contains).not.toHaveBeenCalled();
    expect(menu.querySelector).not.toHaveBeenCalled();
  });

  it('wires selection and Escape to the close handler in source, not computed browser proof', () => {
    const source = readFileSync(new URL('./marketing-mobile-menu.tsx', import.meta.url), 'utf8');
    expect(source.match(/<Link\b/g) ?? []).toHaveLength(5);
    expect(source.match(/<Link\b[^>]*onClick=\{closeOnSelection\}/g) ?? []).toHaveLength(5);
    expect(source).toMatch(/event\.key === 'Escape'\) closeMobileMenu\(menu\.current, document\.activeElement\)/);
    expect(source).toContain("document.addEventListener('keydown', onKeyDown)");
    expect(source).toContain("document.removeEventListener('keydown', onKeyDown)");
    expect(readFileSync(new URL('./phase-one.tsx', import.meta.url), 'utf8').match(/<MarketingMobileMenu \/>/g)).toHaveLength(1);
  });

  it('permanently redirects the dead /preview-access address to the pricing route', () => {
    const source = readFileSync(new URL('../../../next.config.mjs', import.meta.url), 'utf8');
    expect(source).toContain("'/preview-access'");
    expect(source).toMatch(/destination:\s*'\/pricing'/);
    expect(source).toContain('permanent: true');
  });

  it('does not link the preview-access page back to itself and links to the home sections instead of repeating them', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    const html = renderToStaticMarkup(<Pricing />);
    expect(html).toContain('Preview access');
    expect(html).toContain('href="/#phase-one"');
    expect(html).toContain('href="/#questions"');
    expect(html).toContain('href="/features"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('Sign in with your review account');
    expect(html).toContain('href="/contact"');
    expect(html).toContain('Questions about preview access');
    expect(html).toContain('existing review account');
    expect(html).not.toContain('id="phase-one"');
    expect(html).not.toContain('The work-winning essentials');
    expect(html).not.toContain('get started');
    expect(html).not.toContain('href="/pricing"');
    expect(html).not.toContain('About preview access');
    expect(html).not.toContain('Open Constructa');
  });

  it('retains real access-link arrows but removes arrows from non-interactive journey cards on the home page', () => {
    const html = renderToStaticMarkup(<PhaseOneHome />);
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('About preview access');
    const journey = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/)?.[1];
    expect(journey).toBeDefined();
    expect(journey).not.toMatch(/<a\b|<button\b|tabindex=/i);
    const arrows = journey!.match(/<svg\b[^>]*>/g) ?? [];
    expect(arrows).toHaveLength(0);
    for (const destination of ['/apply', '/login', '/pricing']) {
      const links = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
      expect(links.some(link => link.includes(`href="${destination}"`) && /<svg\b/.test(link))).toBe(true);
    }
  });

  it('links to the home journey instead of repeating journey, scope and questions on the product pages', () => {
    for (const Page of [PhaseOneFeatures, PhaseOnePricing]) {
      const html = renderToStaticMarkup(<Page />);
      expect(html).not.toContain('id="how-it-works"');
      expect(html).not.toContain('id="phase-one"');
      expect(html).not.toContain('id="questions"');
      expect(html).not.toContain('Less starting again');
      expect(html).not.toContain('The work-winning essentials');
      expect(html).not.toContain('get started');
    }
    expect(renderToStaticMarkup(<PhaseOneFeatures />)).toContain('href="/#how-it-works"');
    expect(renderToStaticMarkup(<PhaseOnePricing />)).toContain('href="/#questions"');
  });

  it('introduces the complete work-winning journey without an add-on sales form', () => {
    const html = renderToStaticMarkup(<PhaseOneHome />);
    expect(html).toContain('Good work.');
    for (const label of ['Make it your business.', 'Put a price to the work.', 'Give the job a plan.', 'Present the whole picture.']) expect(html).toContain(label);
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/apply"');
    expect(html).toContain('Apply to the founding cohort');
    expect(html).toContain('Founding cohort opens 7 December 2026.');
    expect(html).toContain('id="how-it-works"');
    expect(html).toContain('id="questions"');
    expect(html).toContain('id="marketing-content"');
    expect(html).toContain('Illustrative example');
    expect(html).not.toMatch(/<form|<script|<iframe|href="[^\"]*checkout|Paddle|Formspree/i);
  });

  it('keeps chatbot and release limitations explicit on the canonical home page', () => {
    const html = renderToStaticMarkup(<PhaseOneHome />);
    expect(html).toContain('not available as a live chatbot');
    expect(html).toContain('being verified before live customer use');
    expect(html).toContain('not a claim that every part is ready for release');
    expect(html).not.toContain('24/7');
    expect(html).not.toContain('AI-powered construction management');
  });

  it('does not invent a price, free trial, payment link or paid entitlement', () => {
    const html = renderToStaticMarkup(<PhaseOnePricing />);
    expect(html).toContain('no subscription, free trial or payment is offered here');
    expect(html).toContain('Preview access remains on hold for new accounts');
    expect(html).toContain('not ready for live customer work');
    expect(html).toContain('Sign in with your review account');
    expect(html).toContain('href="/contact"');
    expect(html).not.toContain('Open Constructa');
    expect(html).not.toMatch(/£|<form|<button|href="https?:/);
    expect(html).not.toContain('14-day');
  });

  it.each([['home', Home], ['landing', Landing], ['pricing', Pricing], ['features', Features], ['product', Product]] as const)('uses phase-one content on the %s route by default', (_name, Page) => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Enterprise');
    expect(html).not.toContain('Get Started for free');
    expect(html).not.toContain('Centralised Cost Tracking');
  });

  it.each([['home', Home, 'Apply to the founding cohort'], ['landing', Landing, 'Apply to the founding cohort'], ['pricing', Pricing, 'Enterprise'], ['features', Features, 'Centralised Cost Tracking'], ['product', Product, 'Deliver it']] as const)('retains the original %s view under the existing full profile', (_name, Page, marker) => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain(marker);
    expect(html).not.toContain('not available as a live chatbot');
  });

  it('keeps public navigation within the phase-one scope', () => {
    const html = renderToStaticMarkup(<><MarketingHeader /><MarketingFooter /></>);
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/guides"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/apply"');
    expect(html).toContain('Apply to the founding cohort');
    expect(html).toContain('href="/privacy-policy"');
    expect(html).toContain('href="/terms-of-service"');
    expect(html).not.toContain('/dashboard/resources');
    expect(html).not.toContain('FeatureDropdown');
  });

  it('selects the same public header and footer while retaining full-profile navigation', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    expect(renderToStaticMarkup(<Header />)).toContain('Guides');
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

  it('applies the marketing theme and skip styling together to the shared skip anchor', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    route.pathname = '/';
    const html = renderToStaticMarkup(<PublicChrome><p>Route body</p></PublicChrome>);
    const anchor = html.match(/<a\b[^>]*href="#public-marketing-content"[^>]*>Skip to content<\/a>/)?.[0];
    expect(anchor).toBeDefined();
    const classes = anchor!.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain(ui.theme);
    expect(classes).toContain(ui.skip);
  });

  it('keeps the full landing footer self-contained but supplies the cohort landing footer', () => {
    route.pathname = '/landing';
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    expect(renderToStaticMarkup(<PublicChrome><p>Landing</p></PublicChrome>)).not.toContain('<footer');
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    expect(renderToStaticMarkup(<PublicChrome><p>Landing</p></PublicChrome>)).toContain('Footer navigation');
  });

  it.each(['/', '/features', '/pricing', '/product', '/contact', '/about', '/guides', '/apply'])('renders one bypass before the header targeting the single focusable main on %s', pathname => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    route.pathname = pathname;
    const html = renderToStaticMarkup(<PublicChrome><p>Route body</p></PublicChrome>);
    const anchors = html.match(/<a\b[^>]*href="#public-marketing-content"[^>]*>Skip to content<\/a>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(html.indexOf('Skip to content')).toBeLessThan(html.indexOf('<header'));
    const mains = html.match(/<main\b[^>]*>/g) ?? [];
    expect(mains).toHaveLength(1);
    expect(mains[0]).toContain('id="public-marketing-content"');
    expect(mains[0]).toContain('tabindex="-1"');
  });

  it('keeps one skip anchor and one unique target in the cohort home composition', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    route.pathname = '/';
    const html = renderToStaticMarkup(<PublicChrome><PhaseOneHome /></PublicChrome>);
    expect(html.match(/Skip to content/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('href="#marketing-content"');
    expect(html.match(/id="public-marketing-content"/g) ?? []).toHaveLength(1);
    expect(html.match(/id="marketing-content"/g) ?? []).toHaveLength(1);
    expect(html.indexOf('Skip to content')).toBeLessThan(html.indexOf('<header'));
  });

  it('renders one bypass and focusable main under the full profile', () => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'full');
    route.pathname = '/';
    const html = renderToStaticMarkup(<PublicChrome><p>Full home</p></PublicChrome>);
    const anchors = html.match(/<a\b[^>]*href="#public-marketing-content"[^>]*>Skip to content<\/a>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(html.indexOf('Skip to content')).toBeLessThan(html.indexOf('<header'));
    const mains = html.match(/<main\b[^>]*>/g) ?? [];
    expect(mains).toHaveLength(1);
    expect(mains[0]).toContain('id="public-marketing-content"');
    expect(mains[0]).toContain('tabindex="-1"');
  });

  it.each(['/login', '/onboarding', '/auth/confirm', '/dashboard', '/dashboard/settings/profile', '/admin', '/proposal/example'])('adds no bypass, main id or main tabindex on %s', pathname => {
    vi.stubEnv('NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE', 'cohort');
    route.pathname = pathname;
    const html = renderToStaticMarkup(<PublicChrome><p>Existing page</p></PublicChrome>);
    expect(html).not.toContain('Skip to content');
    expect(html).not.toContain('public-marketing-content');
    const mains = html.match(/<main\b[^>]*>/g) ?? [];
    expect(mains).toHaveLength(1);
    expect(mains[0]).not.toContain('id=');
    expect(mains[0]).not.toContain('tabindex');
  });
});
