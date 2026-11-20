import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  aboutCaptureOrigin,
  aboutCaptures,
  removedUnverifiedIllustrations,
} from './about-image-provenance';

describe('About image provenance registry (#191)', () => {
  it('registers the five removed unverified illustrations with reasons', () => {
    expect(removedUnverifiedIllustrations.map((item) => item.src)).toEqual([
      '/images/minimalist infographic cluster of small construction buildings.png',
      '/images/spreadsheet grid and warning & error symbols.png',
      '/images/about-1m-construction-firms.png',
      '/images/about-weekly-admin.png',
      '/images/about-spreadsheets.png',
    ]);
    for (const item of removedUnverifiedIllustrations) {
      expect(item.reason).toMatch(/unknown rights/i);
      expect(existsSync(`public${item.src}`), item.src).toBe(true);
    }
  });

  it('keeps every verified capture backed by a committed evidence file', () => {
    for (const [key, capture] of Object.entries(aboutCaptures)) {
      const bytes = readFileSync(capture.sourcePath);
      expect(bytes.byteLength, capture.sourcePath).toBeGreaterThan(10_000);
      expect(capture.sourcePath, key).toContain('docs/evidence/marketing-product-screenshots-2026-11-15/');
      expect(capture.capturedOn).toBe('2026-11-15');
      expect(capture.capturedLabel).toBe('15 November 2026');
      // Full-page fixture captures: the true pixel height exceeds the width.
      expect(capture.height).toBeGreaterThan(capture.width);
      expect(capture.width).toBe(1440);
    }
  });

  it('carries an honest synthetic disclosure on every verified capture', () => {
    for (const capture of Object.values(aboutCaptures)) {
      expect(capture.alt).toContain('synthetic phase-one journey');
      expect(capture.caption).toContain('synthetic journey fixture capture from 15 November 2026');
      expect(capture.caption).toContain('made-up job data');
      expect(capture.caption).toContain('simulated saves');
    }
    expect(aboutCaptureOrigin).toContain('docs/evidence/marketing-product-screenshots-2026-11-15');
    expect(aboutCaptureOrigin).toContain('simulated saves');
  });
});
