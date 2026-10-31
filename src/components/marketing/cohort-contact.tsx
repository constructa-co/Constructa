import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import styles from './cohort-contact.module.css';

const EMAIL = 'hello@constructa.co';

const facts = [
  'This page has no form and sends nothing. Choosing the email link opens your own email app with our address ready.',
  'Please do not paste private project or customer details into your message until we have agreed how to handle them.',
  'Questions about the phase-one scope are welcome.',
] as const;

const navLinks = [
  { href: '/features', label: 'The product' },
  { href: '/pricing', label: 'Preview access' },
  { href: '/', label: 'Back to overview' },
] as const;

export function PhaseOneContact() {
  return (
    <main className={`${styles.theme} ${styles.root}`}>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}><span className={styles.dot} aria-hidden="true" /> Contact</p>
        <h1>Talk to the team <em>behind phase one.</em></h1>
        <p>
          Constructa is in a focused phase-one preview. The simplest way to reach us is by
          email — the link below opens your own email client, and you stay in control of what
          is sent and when.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href={`mailto:${EMAIL}`}>
            {EMAIL} <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <p className={styles.mailFallback}>
          Prefer to type it yourself? Write to{' '}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> from the email account you normally use.
        </p>
      </section>
      <section className={styles.panel} aria-labelledby="contact-what-to-expect">
        <div className={styles.panelInner}>
          <h2 id="contact-what-to-expect">What to expect</h2>
          <ul className={styles.facts}>
            {facts.map((fact) => (
              <li key={fact}>
                <Check size={16} aria-hidden="true" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
          <nav aria-label="Contact page navigation">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.textLink}>
                {link.label} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
