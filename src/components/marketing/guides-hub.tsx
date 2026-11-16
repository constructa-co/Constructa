import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GUIDE_ARTICLES } from '@/lib/marketing-guides';
import ui from './phase-one.module.css';
import styles from './guides.module.css';

export function GuidesHub() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section className={ui.pageIntro} data-reveal>
        <p className={ui.eyebrow}>Guides and insights</p>
        <h1>Short reads for<br /><em>phase-one review.</em></h1>
        <p>
          Practical checklists tied to the company, brief, price, programme and proposal journey.
          Written for people using an existing review account.
        </p>
      </section>
      <section className={ui.section} aria-labelledby="guides-list-title" data-reveal>
        <div className={ui.sectionIntro}>
          <p className={ui.eyebrow}>The review guide</p>
          <h2 id="guides-list-title">Short reads before you share anything.</h2>
          <p>
            Each guide follows the connected review journey: what to add, what you get back, and what to
            check before you move on or share a proposal.
          </p>
        </div>
        <div className={styles.hubIndex}>
          {GUIDE_ARTICLES.map((article, index) => (
            <Link key={article.slug} href={`/guides/${article.slug}`} className={styles.card}>
              <span className={styles.cardIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className={styles.cardBody}>
                <h3>{article.title}</h3>
                <p>{article.summary}</p>
                <span className={styles.cardMeta}>
                  Review checklist · Updated <time dateTime={article.contentUpdatedIso}>{article.contentUpdatedDisplay}</time>
                </span>
                <span className={styles.cardCta}>
                  Read guide <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
