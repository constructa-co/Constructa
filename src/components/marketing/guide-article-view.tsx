import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { GuideArticle } from '@/lib/marketing-guides';
import ui from './phase-one.module.css';
import styles from './guides.module.css';

function StepList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.list}>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function GuideArticleView({ article }: { article: GuideArticle }) {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section className={ui.pageIntro}>
        <p className={ui.eyebrow}>Guide</p>
        <h1>{article.title}</h1>
        <p>{article.intro}</p>
        <p>{article.previewNote}</p>
        <Link href="/guides" className={ui.textLink}>
          Back to guides <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {article.steps.map(step => (
        <section key={step.title} className={`${ui.section} ${styles.articleSection}`} aria-labelledby={`step-${step.title}`}>
          <h2 id={`step-${step.title}`}>{step.title}</h2>
          <div className={styles.stepPanel}>
            <dl className={styles.grid}>
              <div>
                <dt>You add</dt>
                <dd>
                  <StepList items={step.add} />
                </dd>
              </div>
              <div>
                <dt>You get</dt>
                <dd>
                  <StepList items={step.get} />
                </dd>
              </div>
              <div>
                <dt>Check before sharing</dt>
                <dd>{step.check}</dd>
              </div>
            </dl>
          </div>
        </section>
      ))}

      <section className={ui.section} aria-labelledby="guide-summary-title">
        <h2 id="guide-summary-title">Before you move on</h2>
        <ul className={styles.checklist}>
          {article.closingChecks.map(item => (
            <li key={item}>
              <Check size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Live AI assistance, new account sign-up, release for real customers, checkout, complete photo or consent
          journeys and security certification are held back from this preview. None is claimed here.
        </p>
        <nav className={styles.footerNav} aria-label="Related links">
          <Link href="/guides" className={ui.textLink}>
            All guides <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/pricing" className={ui.textLink}>
            How preview access works <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </section>
    </div>
  );
}
