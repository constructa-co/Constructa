# Story film #165 — first cut evidence (synthetic cloud)

- **Branch:** `codex/story-film-storyboard-20261115` @ `ae6a53df` (pre-work storyboard) + implementation commits local
- **Storyboard:** `docs/marketing/story-film-storyboard.md`
- **Render:** `npm run story-film:render` (Playwright record + ffmpeg)
- **LCP check:** `npm run story-film:lcp`

## Delivered assets

| Asset | Path | Size check |
| --- | --- | --- |
| 1080p MP4 | `public/marketing/story-film/constructa-story-1080p.mp4` | See `render-manifest.json` (`underSixMb: true`) |
| 720p MP4 | `public/marketing/story-film/constructa-story-720p.mp4` | See `render-manifest.json` |
| Poster | `public/marketing/story-film/constructa-story-poster.webp` | End-card frame |
| Editable source | `marketing/story-film/preview/index.html`, `marketing/story-film/source/*` | 38s scene timing in CSS + `scenes.ts` |

## Playback (cohort home)

- Muted inline loop in hero via `StoryFilmHero` (`src/components/marketing/story-film-hero.tsx`)
- Poster reserved with `aspect-ratio: 16/9`, `preload="metadata"`, `fetchPriority` on poster image
- **Watch the 40-second story** enables sound on demand
- **One-time intro** gated by `NEXT_PUBLIC_STORY_FILM_INTRO_PREVIEW=1` (default off); Skip / Sound / Enter in dialog
- `prefers-reduced-motion`: poster only (end-card frame in film CSS for full-screen render)

## Mobile LCP delta

- Static markup: `lcp-comparison.json`
- Matched Lighthouse on real Next home (ae6a53d vs candidate, guarded e2e env): `lighthouse-lcp-comparison.json`
- Playwright Apply / reduced motion / keyboard / intro default-off: `playback-evidence.json`

## Audio

- Score: `compose-story-film-audio.mjs` (original synth AAC)
- Mux: `mux-story-film-audio.mjs` — h264 + aac; see `codec-report.json`

## Hosted Preview

- `preview-deployment-blocker.json` — Vercel Preview **Error** on db9a588 deploy; evidence from local guarded servers (no settings changes).

## CI workflow (push not performed)

Pushing this branch would trigger existing **CI** (`lint`, `typecheck`, `npm test`, `npm run build`). New public MP4 assets increase checkout size; no workflow file changes in this cut.