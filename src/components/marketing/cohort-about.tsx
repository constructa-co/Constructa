import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { StaticImageData } from 'next/image';
import { aboutCaptures } from './about-image-provenance';
import ui from './phase-one.module.css';
import styles from './cohort-about.module.css';

function AboutFigure({
  src,
  alt,
  width,
  height,
  caption,
}: {
  src: string | StaticImageData;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}) {
  return (
    <figure className={styles.figure}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 900px) 100vw, 42vw"
        className={styles.figureImage}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function PhaseOneAbout() {
  return (
    <div className={`${ui.theme} ${styles.theme} ${styles.root}`}>
      <section className={styles.intro}>
        <p className={ui.eyebrow}>
          <span className={ui.dot} aria-hidden="true" />
          About Constructa
        </p>
        <h1>Why we built Constructa, and what comes next.</h1>
      </section>

      <section className={styles.split}>
        <AboutFigure
          src={aboutCaptures.programmeSavedStages.src}
          alt={aboutCaptures.programmeSavedStages.alt}
          width={aboutCaptures.programmeSavedStages.width}
          height={aboutCaptures.programmeSavedStages.height}
          caption={aboutCaptures.programmeSavedStages.caption}
        />
        <div className={styles.copy}>
          <h2>Built around your own judgement</h2>
          <p>
            Constructa is built for small UK contractors who price jobs from their own knowledge: scope, quantities, labour, plant, materials and subcontract rates.
          </p>
          <p>
            It brings those details together while keeping the judgement with you.
          </p>
          <p>Capture the brief and quantities, enter your own rates, and review the proposal before sharing it.</p>
        </div>
      </section>

      <section className={styles.statement}>
        <div className={styles.copy}>
          <h2>The problem we saw</h2>
          <p>
            Running a small construction company means juggling everything—quoting fast, planning tight, and keeping things
            moving on site.
          </p>
          <ul>
            <li>Proposals get rushed</li>
            <li>Programmes get misaligned</li>
            <li>Project control slips</li>
            <li>And admin takes over</li>
          </ul>
          <p>Check the scope and exclusions as carefully as the total.</p>
        </div>
      </section>

      <section className={styles.split}>
        <figure className={styles.figure}>
          <Image
            src={aboutCaptures.estimatePriceAdjustments.src}
            alt={aboutCaptures.estimatePriceAdjustments.alt}
            width={aboutCaptures.estimatePriceAdjustments.width}
            height={aboutCaptures.estimatePriceAdjustments.height}
            sizes="(max-width: 900px) 100vw, 42vw"
            className={styles.figureImage}
          />
          <figcaption>{aboutCaptures.estimatePriceAdjustments.caption}</figcaption>
        </figure>
        <div className={styles.copy}>
          <h2>The solution we&apos;re building</h2>
          <p>Include preliminaries, overheads, risk and profit, lay out the work on working days, and review the proposal before sharing it.</p>
          <ul>
            <li>Review the estimate and draft proposal</li>
            <li>Review the working days and sequence</li>
            <li>Check scope, exclusions and quantities</li>
            <li>Use your own labour, plant, material and subcontract rates</li>
          </ul>
          <p>Constructa does not measure quantities from drawings or decide your rates and margins. A programme needs your review against the real site, people and suppliers.</p>
        </div>
      </section>


      <section className={styles.metrics}>
        <h2>Why now?</h2>
        <div className={styles.metricGrid}>
          {[
            {
              title: 'Small firms are the backbone of the sector',
              body: 'Enter the quantities and rates you intend to use.',
            },
            {
              title: 'Admin eats into every working week',
              body: 'Time spent chasing info and retyping quotes is time away from the job.',
            },
            {
              title: 'Spreadsheets are still the default',
              body: 'Keep scope, exclusions and totals consistent through your own review.',
            },
          ].map((item) => (
            <div key={item.title} className={styles.metricCard}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.statement} ${styles.nextRow}`}>
        <div className={styles.copy}>
          <h2>What&apos;s next</h2>
          <p>
            Constructa is in a phase-one review. We are checking the complete work-winning journey before release—it is not
            currently offered for live customer work.
          </p>
          <p>The work-winning journey centres on company, brief, estimate, programme and proposal. Later delivery tools are not promised as ready.</p>
          <p>
            Access is currently limited to existing review accounts. New signup, payment and enquiry collection remain off.
          </p>
          <div className={styles.actions}>
            <Link href="/apply" className={ui.primary}>
              Apply to the founding cohort →
            </Link>
            <Link href="/pricing" className={ui.textLink}>
              Preview access →
            </Link>
            <Link href="/guides" className={ui.textLink}>
              Read the guides →
            </Link>
            <a
              href="https://www.linkedin.com/company/constructa-co"
              className={ui.textLink}
            >
              Follow us on LinkedIn <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className={styles.pointers}>
        <h2>Where to look next</h2>
        <div className={styles.pointerGrid}>
          <div>
            <strong>Review your company profile, brief and price</strong>
            Phase-one checklists from the review guide
            <div>
              <Link href="/guides" className={ui.textLink}>
                constructa.co/guides
              </Link>
            </div>
          </div>
          <div>
            <strong>Behind the build: Constructa&apos;s approach</strong>
            Updates from the team as the review progresses
            <div>
              <a href="https://www.linkedin.com/company/constructa-co" className={ui.textLink}>
                linkedin.com/company/constructa-co
              </a>
            </div>
          </div>
          <div>
            <strong>Preview access and phase-one scope</strong>
            What is in the review and what still needs release verification
            <div>
              <Link href="/pricing" className={ui.textLink}>
                constructa.co/pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}