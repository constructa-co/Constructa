import React from 'react';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeBusinessVisual } from './home-business-visual';
import { PhaseOneFeatures, PhaseOneHome, PhaseOnePricing } from './phase-one';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = () => renderToStaticMarkup(<HomeBusinessVisual />);
const visibleText = () => html()
  .replace(/<svg\b[\s\S]*?<\/svg>/g, ' ')
  .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const QUALIFIER = 'Not an app screenshot';

describe('homepage business illustration', () => {
  it('qualifies itself visibly as an illustration inside its figure caption', () => {
    const caption = html().match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '';
    expect(html()).toMatch(/^<figure\b/);
    expect(caption).toContain('>Illustration<');
    expect(caption).toContain(`>${QUALIFIER}<`);
  });

  it('explains company profile, relevant past work and proposal as ordered text', () => {
    const list = html().match(/<ol[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? '';
    const items = list.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
    expect(items).toHaveLength(3);
    ['Company profile', 'Relevant past work', 'Proposal'].forEach((label, index) => expect(items[index]).toContain(`<strong>${label}</strong>`));
    expect(html()).not.toMatch(/<h[1-6]\b/);
  });

  it('hides every decorative shape from assistive technology', () => {
    const shapes = html().match(/<svg\b[^>]*>/g) ?? [];
    expect(shapes).toHaveLength(3);
    for (const shape of shapes) expect(shape).toContain('aria-hidden="true"');
    expect(html()).not.toMatch(/<text\b|<title\b/);
  });

  it('has no controls, links, media loading or data transmission', () => {
    expect(html()).not.toMatch(/<(a|button|input|select|textarea|form|img|image|video|iframe|script)\b|\b(href|src|action|tabindex|onclick)=/i);
    const component = source('./home-business-visual.tsx');
    expect(component).not.toMatch(/use client|use server|useEffect|useState|fetch\(|https?:|next\/image|next\/link/);
    expect(component.match(/^import .*$/gm)).toEqual(["import ui from './home-business-visual.module.css';"]);
  });

  it('invents no customers, figures, endorsements, automation or current-hosted claims', () => {
    expect(visibleText()).not.toMatch(/\d|£|%/);
    expect(visibleText()).not.toMatch(/automatic|\bAI\b|customer|client|trusted|certified|accredited|award|winning|guarantee|faster|live|hosted|available|now/i);
    expect(visibleText()).toContain('you choose');
  });

  it('declares natural, motionless, wrapping layout rules with an inherited font', () => {
    const css = postcss.parse(source('./home-business-visual.module.css'));
    const props: string[] = [];
    css.walkDecls(decl => {
      props.push(decl.prop);
      if (decl.prop === 'font-size') expect(parseFloat(decl.value)).toBeGreaterThanOrEqual(12);
      if (decl.prop === 'width' || decl.prop === 'height') expect(decl.parent?.toString()).toMatch(/::(before|after)|\.mark/);
    });
    for (const banned of ['animation', 'transition', 'font-family', 'white-space', 'aspect-ratio', 'min-height', 'min-width: 320px']) expect(props).not.toContain(banned);
    expect(css.toString()).not.toMatch(/@keyframes|url\(/);
    let phoneResetsIndent = false;
    css.walkAtRules('media', rule => { if (rule.params === '(max-width: 450px)') rule.walkDecls('margin-left', decl => { phoneResetsIndent = decl.value === '0'; }); });
    expect(phoneResetsIndent).toBe(true);
  });
});

describe('homepage business illustration placement', () => {
  const home = () => renderToStaticMarkup(<PhaseOneHome />);

  it('replaces the old story image between the journey and the story copy, once', () => {
    const page = home();
    const [journey, visual, story, scope] = ['id="how-it-works"', QUALIFIER, 'The experience behind the estimate', 'id="phase-one"'].map(marker => page.indexOf(marker));
    expect(journey).toBeGreaterThan(-1);
    expect(visual).toBeGreaterThan(journey);
    expect(story).toBeGreaterThan(visual);
    expect(scope).toBeGreaterThan(story);
    expect(page.split(QUALIFIER)).toHaveLength(2);
    expect(page).toContain(html());
    expect(page).not.toMatch(/about-hero|<img\b/);
    expect(page).not.toContain('Construction team reviewing plans together');
  });

  it('preserves the labelled hero, story prose and story action', () => {
    const page = home();
    expect(page).toContain('Illustrative example');
    expect(page).toContain('Oak &amp; Stone');
    expect(page).toContain('Construction is a people business.');
    expect(page).toContain('Whether you fit kitchens, refurbish workplaces or run a multi-trade team, the story should be yours.');
    expect(page).toContain('Start with your business');
  });

  it('stays off the features and pricing pages', () => {
    for (const Page of [PhaseOneFeatures, PhaseOnePricing]) expect(renderToStaticMarkup(<Page />)).not.toContain(QUALIFIER);
  });
});
