/// <reference types="next/image-types/global" />
import { getImageProps } from 'next/image';
import estimateCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-1440x900.jpg';
import estimatePhoneCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/01-estimate-price-adjustments-390x844.jpg';
import programmeCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-1440x900.jpg';
import programmePhoneCapture from '../../../docs/evidence/marketing-product-screenshots-2026-11-15/02-programme-saved-stages-390x844.jpg';
import ui from './phase-one.module.css';
import shots from './product-screenshots.module.css';

export const captures = [
  {
    src: estimateCapture,
    phoneSrc: estimatePhoneCapture,
    alt: 'Constructa estimating screen from a synthetic phase-one journey. It shows the Price adjustments panel with percentage fields for overhead, risk and profit, an optional discount reason, and a grey control reading No changes to save when nothing has changed.',
    title: 'Price percentages on an estimate',
    description: 'Adjust overhead, risk, profit and discount on a priced estimate. The control stays inactive while nothing has changed.',
    sample: 'All figures belong to a synthetic roof repair job. They are not prices, typical margins or a quote.',
    capturedOn: '2026-11-15',
    capturedLabel: '15 November 2026',
  },
  {
    src: programmeCapture,
    phoneSrc: programmePhoneCapture,
    alt: 'Constructa programme screen from a synthetic phase-one journey. It shows saved stages named Strip out and First fix, each with stage lengths and dates in the proposal preview.',
    title: 'Saved programme stages',
    description: 'Name stages in your own words, set lengths, and preview how they read on the proposal before continuing.',
    sample: 'The stage names, lengths and dates are synthetic entries. They are not a standard programme or a promise of how long any job takes.',
    capturedOn: '2026-11-15',
    capturedLabel: '15 November 2026',
  },
] as const;

export function CapturePicture({ capture }: { capture: (typeof captures)[number] }) {
  const { alt, src, phoneSrc } = capture;
  const { props: { srcSet: phoneSrcSet } } = getImageProps({ src: phoneSrc, alt, width: 390, height: 844, sizes: '88vw' });
  const { props: desktop } = getImageProps({ src, alt, width: 1440, height: 900, sizes: '(max-width: 1422px) 100vw, 1440px' });
  return (
    <picture>
      <source media="(max-width: 600px)" srcSet={phoneSrcSet} sizes="88vw" width={390} height={844} />
      <img {...desktop} alt={alt} />
    </picture>
  );
}

export function ProductScreenshots() {
  return (
    <section id="product-screenshots" aria-labelledby="product-screenshots-title" className={`${ui.section} ${shots.screenshots}`}>
      <div className={ui.sectionIntro}>
        <p className={ui.eyebrow}>Example screens</p>
        <h2 id="product-screenshots-title">Two example screens.<br />From the current review interface.</h2>
        <p>A closer look at two steps in the guide above: setting price percentages on an estimate, and saving a programme ready for proposal review.</p>
      </div>

      <p className={shots.qualification}>
        These are synthetic journey fixture captures from 15 November 2026. They show the current review interface with made-up data and simulated saves. Live signup, email and production saving require separate verification. Controls may still change before release.
      </p>

      <div className={shots.figures}>
        {captures.map(capture => (
          <figure key={capture.title} className={shots.figure}>
            <CapturePicture capture={capture} />
            <figcaption>
              <div>
                <h3>{capture.title}</h3>
                <p className={shots.capturedLine}>Synthetic journey fixture capture · <time dateTime={capture.capturedOn}>{capture.capturedLabel}</time> · Current review interface · Simulated saves</p>
              </div>
              <div>
                <p>{capture.description}</p>
                <p>{capture.sample}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
