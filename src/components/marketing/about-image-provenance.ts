import type { StaticImageData } from 'next/image';
import estimatePriceAdjustmentsCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-1440x900.jpg';
import programmeSavedStagesCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-1440x900.jpg';

export interface AboutCapture {
  src: StaticImageData;
  /** Repo-relative path of the committed evidence file backing this capture. */
  sourcePath: string;
  /** True pixel dimensions of the committed capture (full-page fixtures). */
  width: number;
  height: number;
  alt: string;
  caption: string;
  capturedOn: string;
  capturedLabel: string;
}

const CAPTURE_ORIGIN =
  'Owned capture of the Constructa review interface from a synthetic phase-one journey fixture run. Committed evidence under docs/evidence/marketing-product-screenshots-2026-11-15; made-up job data and simulated saves.';

export const aboutCaptureOrigin = CAPTURE_ORIGIN;

/**
 * The only imagery provenance class allowed on About: owned, verified
 * Constructa product captures with a synthetic-data disclosure. width/height
 * are the true pixel dimensions of the committed files.
 */
export const aboutCaptures = {
  estimatePriceAdjustments: {
    src: estimatePriceAdjustmentsCapture,
    sourcePath:
      'docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-1440x900.jpg',
    width: 1440,
    height: 2367,
    alt: 'Constructa estimating screen from a synthetic phase-one journey. It shows the Price adjustments panel with percentage fields for overhead, risk and profit, an optional discount reason, and a grey control reading No changes to save when nothing has changed.',
    caption:
      'The current review interface · synthetic journey fixture capture from 15 November 2026 · made-up job data · simulated saves.',
    capturedOn: '2026-11-15',
    capturedLabel: '15 November 2026',
  },
  programmeSavedStages: {
    src: programmeSavedStagesCapture,
    sourcePath:
      'docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-1440x900.jpg',
    width: 1440,
    height: 2126,
    alt: 'Constructa programme screen from a synthetic phase-one journey. It shows saved stages named Strip out and First fix, each with stage lengths and dates in the proposal preview.',
    caption:
      'Saved programme stages in the current review interface · synthetic journey fixture capture from 15 November 2026 · made-up job data · simulated saves.',
    capturedOn: '2026-11-15',
    capturedLabel: '15 November 2026',
  },
} as const satisfies Record<string, AboutCapture>;

/**
 * Illustrations removed from About by snag #191: both were bulk-uploaded in
 * commit eedf67c with no licence, origin or generation record anywhere in the
 * repository, so their rights are unknown. They must not be reintroduced.
 * The files remain on disk (deletes are not permitted) but nothing on About
 * references them.
 */
export const removedUnverifiedIllustrations = [
  {
    src: '/images/minimalist infographic cluster of small construction buildings.png',
    reason:
      'Unknown rights: bulk-uploaded in commit eedf67c with no licence or origin evidence in the repo.',
  },
  {
    src: '/images/spreadsheet grid and warning & error symbols.png',
    reason:
      'Unknown rights: bulk-uploaded in commit eedf67c with no licence or origin evidence in the repo.',
  },
  { src: '/images/about-1m-construction-firms.png', reason: 'Unknown rights: no licence or origin evidence in the repo.' },
  { src: '/images/about-weekly-admin.png', reason: 'Unknown rights: no licence or origin evidence in the repo.' },
  { src: '/images/about-spreadsheets.png', reason: 'Unknown rights: no licence or origin evidence in the repo.' },
] as const;
