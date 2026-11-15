/// <reference types="next/image-types/global" />
import { getImageProps } from 'next/image';
import estimateCapture from '../../../docs/evidence/stage2-tranche-2f/07-estimate-priced-1440x900.jpg';
import estimatePhoneCapture from '../../../docs/evidence/stage2-tranche-2f/07-estimate-priced-390x844.jpg';
import programmeCapture from '../../../docs/evidence/stage2-tranche-2f/12-programme-saved-1440x900.jpg';
import programmePhoneCapture from '../../../docs/evidence/stage2-tranche-2f/12-programme-saved-390x844.jpg';
import ui from './phase-one.module.css';
import shots from './product-screenshots.module.css';

const captures = [
  {
    src: estimateCapture,
    phoneSrc: estimatePhoneCapture,
    alt: 'Constructa estimating screen from a synthetic phase-one journey. It shows percentage fields for overhead, risk and profit, an optional discount reason, and a grey action reading No changes to save.',
    title: 'Price percentages on an estimate',
    description: 'Adjust overhead, risk, profit and discount on a priced estimate. The control stays inactive while nothing has changed.',
    sample: 'All figures belong to a synthetic bathroom refit. They are not prices, typical margins or a quote.',
    capturedOn: '2026-10-05',
    capturedLabel: '5 October 2026',
  },
  {
    src: programmeCapture,
    phoneSrc: programmePhoneCapture,
    alt: 'Constructa programme screen from a synthetic phase-one journey. It shows three saved stages named Strip out, First fix and tiling, and Second fix and finish, each with working-day lengths and dates in the proposal preview.',
    title: 'Saved programme stages',
    description: 'Name stages in your own words, set lengths, and preview how they read on the proposal before continuing.',
    sample: 'The stage names, lengths and dates are synthetic entries. They are not a standard programme or a promise of how long any job takes.',
    capturedOn: '2026-10-05',
    capturedLabel: '5 October 2026',
  },
] as const;

function CapturePicture({ capture }: { capture: (typeof captures)[number] }) {
  const { alt, src, phoneSrc } = capture;
  const { props: { srcSet: phoneSrcSet } } = getImageProps({ src: phoneSrc, alt, width: 780, height: 1688, sizes: '88vw' });
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
        These are synthetic journey fixture captures from 5 October 2026. They show the current review interface on a disposable test database with made-up data. They are not proof that live customer sign-up, email send or production saving is available. Controls may still change before release.
      </p>

      <div className={shots.figures}>
        {captures.map(capture => (
          <figure key={capture.title} className={shots.figure}>
            <CapturePicture capture={capture} />
            <figcaption>
              <div>
                <h3>{capture.title}</h3>
                <p className={shots.capturedLine}>Synthetic journey fixture capture · <time dateTime={capture.capturedOn}>{capture.capturedLabel}</time> · Current review interface · Disposable test database</p>
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