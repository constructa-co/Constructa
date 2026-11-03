import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GUIDE_ARTICLES } from '@/lib/marketing-guides';
import ui from './phase-one.module.css';
import styles from './guides.module.css';

export function GuidesHub() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section className={ui.pageIntro}>
        <p className={ui.eyebrow}>Guides and insights</p>
        <h1>Short reads for<br /><em>phase-one review.</em></h1>
        <p>
          Practical checklists tied to the company, brief, price, programme and proposal journey.
          Written for people using an existing review account — not a claim that every held feature is available.
        </p>
      </section>
      <section className={ui.section} aria-labelledby="guides-list-title">
        <div className={ui.sectionIntro}>
          <p className={ui.eyebrow}>On this hub</p>
          <h2 id="guides-list-title">Two checklists from the review guide.</h2>
        </div>
        <div className={styles.hubCards}>
          {GUIDE_ARTICLES.map(article => (
            <Link key={article.slug} href={`/guides/${article.slug}`} className={styles.card}>
              <h2>{article.title}</h2>
              <p>{article.summary}</p>
              <span>
                Read guide <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
