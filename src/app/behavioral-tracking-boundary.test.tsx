import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RootLayout from './layout';
import FullLandingPage from '@/components/marketing/full-landing';
import PublicAnalytics from '@/components/public-analytics';

vi.mock('next/font/google', () => ({ Inter: () => ({ className: 'test-font' }) }));
vi.mock('@/components/public-chrome', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('next/script', () => ({ default: ({ children, id, src }: { children?: React.ReactNode; id?: string; src?: string }) => <script async id={id} src={src}>{children}</script> }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@vercel/analytics/next', () => ({ Analytics: () => <i data-vercel-analytics="mounted" /> }));
afterEach(() => vi.unstubAllEnvs());

it('does not inject automatic analytics or replay around confidential child content', async () => {
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '0');
    const html = renderToStaticMarkup(await RootLayout({ children: <main>TEST DATA - private project</main> }));
    expect(html).toContain('TEST DATA - private project');
    expect(html).toContain('id="sw-register"');
    expect(html).not.toContain('https://plausible.io/js/script.js');
    expect(html).not.toContain('id="plausible-events"');
    expect(html).not.toContain('window.plausible');
    expect(html).not.toMatch(/clarity-script|microsoft-clarity|clarity\.ms\/tag\//);
    // Vercel Web Analytics mounts only after the client confirms a public route
    // and no session, so the server HTML never carries it or its loader.
    expect(html).not.toContain('data-vercel-analytics');
    expect(html).not.toContain('/_vercel/insights');
});

it('does not leave a landing analytics or replay loader that can survive navigation to private pages', () => {
    const html = renderToStaticMarkup(<FullLandingPage />);
    expect(html).toContain('Join the waitlist');
    expect(html).not.toContain('https://plausible.io/js/script.js');
    expect(html).toContain('src="/feature-scroll.js"');
    expect(html).not.toContain('id="plausible-contact"');
    expect(html).not.toContain('window.plausible');
    expect(html).toContain('id="waitlist-form"');
    expect(html).not.toMatch(/clarity-script|microsoft-clarity|clarity\.ms\/tag\//);
});

it('retains the existing protected-review exclusion and child content', async () => {
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '1');
    const html = renderToStaticMarkup(await RootLayout({ children: <main>TEST DATA - review</main> }));
    expect(html).toContain('TEST DATA - review');
    expect(html).toContain('Protected work-in-progress review.');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('data-vercel-analytics');
});

function hasElementOfType(node: unknown, type: unknown): boolean {
    if (Array.isArray(node)) return node.some((child) => hasElementOfType(child, type));
    if (!node || typeof node !== 'object' || !('props' in node)) return false;
    const element = node as { type: unknown; props: { children?: unknown } };
    return element.type === type || hasElementOfType(element.props.children, type);
}

it('mounts the analytics component outside review mode and never in protected review', async () => {
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '0');
    expect(hasElementOfType(await RootLayout({ children: <main /> }), PublicAnalytics)).toBe(true);
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '1');
    expect(hasElementOfType(await RootLayout({ children: <main /> }), PublicAnalytics)).toBe(false);
});
