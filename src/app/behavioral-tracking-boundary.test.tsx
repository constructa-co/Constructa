import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RootLayout from './layout';
import FullLandingPage from '@/components/marketing/full-landing';

vi.mock('next/font/google', () => ({ Inter: () => ({ className: 'test-font' }) }));
vi.mock('@/components/public-chrome', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('next/script', () => ({ default: ({ children, id, src }: { children?: React.ReactNode; id?: string; src?: string }) => <script async id={id} src={src}>{children}</script> }));
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => vi.unstubAllEnvs());

it('does not inject a behavioural replay loader around confidential child content', async () => {
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '0');
    const html = renderToStaticMarkup(await RootLayout({ children: <main>TEST DATA - private project</main> }));
    expect(html).toContain('TEST DATA - private project');
    expect(html).toContain('id="sw-register"');
    expect(html).toContain('https://plausible.io/js/script.js');
    expect(html).toContain('id="plausible-events"');
    expect(html).not.toMatch(/clarity-script|microsoft-clarity|clarity\.ms\/tag\//);
});

it('does not leave a second landing replay loader that can survive navigation to private pages', () => {
    const html = renderToStaticMarkup(<FullLandingPage />);
    expect(html).toContain('Join the waitlist');
    expect(html).toContain('https://plausible.io/js/script.js');
    expect(html).toContain('src="/feature-scroll.js"');
    expect(html).toContain('id="plausible-contact"');
    expect(html).not.toMatch(/clarity-script|microsoft-clarity|clarity\.ms\/tag\//);
});

it('retains the existing protected-review exclusion and child content', async () => {
    vi.stubEnv('CONSTRUCTA_REVIEW_ONLY', '1');
    const html = renderToStaticMarkup(await RootLayout({ children: <main>TEST DATA - review</main> }));
    expect(html).toContain('TEST DATA - review');
    expect(html).toContain('Protected work-in-progress review.');
    expect(html).not.toContain('<script');
});
