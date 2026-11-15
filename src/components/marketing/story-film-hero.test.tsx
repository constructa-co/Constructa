import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { StoryFilmHero } from './story-film-hero';

describe('StoryFilmHero', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STORY_FILM_INTRO_PREVIEW', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reserves layout, poster and muted inline video sources', () => {
    const html = renderToStaticMarkup(<StoryFilmHero />);
    expect(html).toContain('constructa-story-poster.webp');
    expect(html).toContain('constructa-story-720p.mp4');
    expect(html).toContain('constructa-story-1080p.mp4');
    expect(html).toContain('Watch the 40-second story');
    expect(html).toContain('playsInline');
    expect(html).toContain('preload="metadata"');
    expect(html).toMatch(/muted/);
  });

  it('exposes watch control for sound-on-request playback', () => {
    const html = renderToStaticMarkup(<StoryFilmHero />);
    expect(html).toContain('Watch the 40-second story');
    expect(html).toMatch(/type="video\/mp4"/);
  });

  it('hides intro preview control unless env preview flag is set', () => {
    const off = renderToStaticMarkup(<StoryFilmHero />);
    expect(off).not.toContain('Preview one-time intro');
    vi.stubEnv('NEXT_PUBLIC_STORY_FILM_INTRO_PREVIEW', '1');
    const on = renderToStaticMarkup(<StoryFilmHero />);
    expect(on).toContain('Preview one-time intro');
    expect(on).toContain('Skip');
    expect(on).toContain('Enter');
  });
});