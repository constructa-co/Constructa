/// <reference types="next/image-types/global" />
import Image from 'next/image';
import estimateCapture from '../../../docs/evidence/stage2-tranche-2c/18b-estimate-price-adjustments-preview-1280x800.jpg';
import programmeCapture from '../../../docs/evidence/stage2-tranche-2d/04-programme-four-stages-editor-1280x800.jpg';
import ui from './phase-one.module.css';
import shots from './product-screenshots.module.css';

const captures = [
  {
    src: estimateCapture,
    alt: 'Earlier Constructa estimating screen from a synthetic example job. It has percentage fields for risk, profit and discount, a field for the discount reason, a note reading Not saved yet with a preview of the total before VAT, and a blue Save adjustments button.',
    title: 'Price adjustments, before you save',
    description: 'Enter risk, profit and discount percentages and preview the total before saving. The note marks the new total as not saved yet.',
    sample: 'All figures belong to a synthetic bathroom refit. They are not prices, typical margins or a quote.',
    capturedOn: '2026-10-03',
    capturedLabel: '3 October 2026',
  },
  {
    src: programmeCapture,
    alt: 'Earlier Constructa programme screen from a synthetic example job. It lists four optional stages named Strip out, First fix and boarding, Tiling, and Second fix and finish, each with a length and controls to reorder or remove it, above an Add a stage button.',
    title: 'Optional programme stages',
    description: 'Break a job into stages in your own words, give each one a length and change their order. Stages are optional.',
    sample: 'The stage names and lengths are synthetic entries. They are not a standard programme or a promise of how long any job takes.',
    capturedOn: '2026-10-04',
    capturedLabel: '4 October 2026',
  },
] as const;

export function ProductScreenshots() {
  return (
    <section id="product-screenshots" aria-labelledby="product-screenshots-title" className={`${ui.section} ${shots.screenshots}`}>
      <div className={ui.sectionIntro}>
        <p className={ui.eyebrow}>Example screens</p>
        <h2 id="product-screenshots-title">Two example screens.<br />From an earlier interface.</h2>
        <p>A closer look at two steps in the guide above: adjusting a price before saving it, and setting out a programme in stages.</p>
      </div>

      <p className={shots.qualification}>
        These are synthetic example component captures from 3 and 4 October 2026. They show an earlier interface, with made-up data and mocked persistence, so nothing was saved to a database. They are not the current hosted interface. They are not proof that saving, AI, email or customer use is available. The blue controls belong to that earlier interface and do not show the current look.
      </p>

      <div className={shots.figures}>
        {captures.map(capture => (
          <figure key={capture.capturedOn} className={shots.figure}>
            <Image src={capture.src} alt={capture.alt} width={1280} height={800} sizes="(max-width: 1422px) 100vw, 1280px" />
            <figcaption>
              <div>
                <h3>{capture.title}</h3>
                <p className={shots.capturedLine}>Synthetic example component capture · <time dateTime={capture.capturedOn}>{capture.capturedLabel}</time> · Earlier interface · Mocked persistence</p>
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
