import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ui from './phase-one.module.css';
import styles from './cohort-about.module.css';

function AboutFigure({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className={styles.figure}>
      <Image src={src} alt={alt} width={720} height={480} sizes="(max-width: 900px) 100vw, 42vw" />
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
          src="/images/about-hero.png"
          alt="Three people in hard hats gathered around a laptop"
          caption="AI-generated illustration. The people shown are not Constructa staff or clients."
        />
        <div className={styles.copy}>
          <h2>Built by people who know the job</h2>
          <p>
            We&apos;ve spent decades quoting jobs, planning programmes, and juggling the chaos of construction—clipboards,
            emails, spreadsheets, WhatsApp threads, last-minute changes.
          </p>
          <p>
            Constructa was born out of that reality. Not from a VC boardroom or software incubator—but from site visits,
            delivery delays, tight margins, and the stress of getting it right.
          </p>
          <p>We&apos;re not building another tool to add to the pile. We&apos;re building the one that ties everything together.</p>
        </div>
      </section>

      <section className={`${styles.split} ${styles.splitReverse}`}>
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
          <p>Big software platforms are overkill. Manual systems are high risk. And most tools weren&apos;t built for builders.</p>
        </div>
        <AboutFigure
          src="/images/about-problem1.png"
          alt="Illustration of three colleagues discussing drawings on a building site"
        />
      </section>

      <section className={styles.split}>
        <AboutFigure
          src="/images/about-solution.png"
          alt="Illustration of a project team around a table with a glowing programme timeline overlaid"
        />
        <div className={styles.copy}>
          <h2>The solution we&apos;re building</h2>
          <p>Constructa brings quoting, planning, and delivery into one clean, easy-to-use platform.</p>
          <ul>
            <li>Create a clear, client-ready proposal</li>
            <li>Build a job plan that keeps everyone aligned</li>
            <li>Track progress and changes without the spreadsheet stress</li>
            <li>Present a more professional front from day one</li>
          </ul>
          <p>We&apos;re starting simple. And growing with our users—brick by brick.</p>
        </div>
      </section>

      <section className={`${styles.split} ${styles.splitReverse}`}>
        <div className={styles.copy}>
          <h2>A message from the founder</h2>
          <p>
            <em>
              &quot;After 25 years in construction, I knew there had to be a better way. I&apos;ve seen first-hand how hard it is to
              manage projects and people while keeping proposals sharp, programmes aligned, and clients happy.
            </em>
          </p>
          <p>
            <em>
              Constructa isn&apos;t just software—it&apos;s a response to everything I wish I&apos;d had earlier in my career. We&apos;re
              building it with care, with clarity, and with builders front and centre.&quot;
            </em>
          </p>
          <div className={styles.founder}>— Robert Smith</div>
        </div>
        <figure className={styles.figure}>
          <Image
            src="/images/founder-message.png"
            alt="AI-generated illustration of a man standing behind a desk at sunset"
            width={720}
            height={480}
          />
          <figcaption>AI-generated illustration. The person shown is not Robert Smith.</figcaption>
        </figure>
      </section>

      <section className={styles.metrics}>
        <h2>Why now?</h2>
        <div className={styles.metricGrid}>
          {[
            {
              src: '/images/about-1m-construction-firms.png',
              alt: 'Illustration of tower cranes and city buildings linked by a glowing network',
              title: 'Small firms are the backbone of the sector',
              body: 'Micro businesses dominate construction—but have few tools built for the way they actually work.',
            },
            {
              src: '/images/about-weekly-admin.png',
              alt: 'Illustration of a stopwatch with paperwork streaming past',
              title: 'Admin eats into every working week',
              body: 'Time spent chasing info and retyping quotes is time away from the job.',
            },
            {
              src: '/images/about-spreadsheets.png',
              alt: 'Illustration of a spreadsheet marked with errors beside a hard hat and level',
              title: 'Spreadsheets are still the default',
              body: 'Most general platforms are too complex, and manual systems are high risk.',
            },
          ].map((item) => (
            <div key={item.title} className={styles.metricCard}>
              <Image src={item.src} alt={item.alt} width={160} height={160} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.split} ${styles.splitReverse} ${styles.nextRow}`}>
        <div className={styles.copy}>
          <h2>What&apos;s next</h2>
          <p>
            Constructa is in a phase-one review. We are checking the complete work-winning journey before release—it is not
            currently offered for live customer work.
          </p>
          <p>From here, we&apos;re expanding into contracts, resource tracking, client comms, and more.</p>
          <p>
            Preview access explains what is in scope for this review and what still needs release verification before live use.
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
        <AboutFigure
          src="/images/about-whats-next.png"
          alt="Illustration of colleagues reviewing drawings around a studio table"
        />
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