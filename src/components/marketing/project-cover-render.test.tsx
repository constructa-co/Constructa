import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  COVER_ARTWORK_CAPTION,
  COVER_FALLBACK_SRC,
  COVER_PRIMARY_SRC,
  COVER_RENDER_ALT,
  COVER_RENDER_CAPTION,
  coverFor,
  ProjectCoverRender,
} from './project-cover-render';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = () => renderToStaticMarkup(<ProjectCoverRender priority />);

describe('A074 project cover render', () => {
  it('renders the approved primary render inside a figure with its mandatory caption', () => {
    const markup = html();
    expect(markup).toContain('<figure');
    expect(markup).toContain('<figcaption');
    const caption = markup.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '';
    expect(caption).toContain(COVER_RENDER_CAPTION);
    expect(markup).not.toContain(COVER_ARTWORK_CAPTION);
  });

  it('points the image at the approved asset with the approved descriptive alt text', () => {
    const image = html().match(/<img\b[^>]*>/)?.[0] ?? '';
    expect(image).toContain('url=%2FSetting%20us%20apart.png');
    expect(image).toContain(`alt="${COVER_RENDER_ALT}"`);
    expect(image).not.toContain(COVER_FALLBACK_SRC);
  });

  it('switches to the line-art fallback and its own mandatory caption when the render cannot load', () => {
    expect(coverFor(true)).toEqual({ src: COVER_FALLBACK_SRC, caption: COVER_ARTWORK_CAPTION });
    expect(coverFor(false)).toEqual({ src: COVER_PRIMARY_SRC, caption: COVER_RENDER_CAPTION });
    expect(source('./project-cover-render.tsx')).toContain('onError');
  });

  it('never drops the mandatory caption in either state', () => {
    for (const state of [coverFor(false), coverFor(true)]) {
      expect(state.caption).toMatch(/not a photograph of completed work\.$/);
    }
  });
});
