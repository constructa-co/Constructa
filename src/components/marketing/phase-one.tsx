import { NewsletterSignup } from './newsletter-signup';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, Plus } from 'lucide-react';
import { BrandMark } from '../brand-mark';
import { HomeBusinessVisual } from './home-business-visual';
import { HomeReviewCaptures } from './home-review-captures';
import { MarketingMobileMenu } from './marketing-mobile-menu';
import { ProductReviewGuide } from './product-review-guide';
import { ProductScreenshots } from './product-screenshots';
import { FoundingCohortPricingPanel } from './founding-cohort-pricing-panel';
import ui from './phase-one.module.css';

const stages = [
  { number: '01', title: 'Scope first.', label: 'Brief', description: 'Write down the work, refer to the drawings and note the quantities before you price anything.', detail: 'Your job brief, scope and quantities.' },
  { number: '02', title: 'Price the work.', label: 'Estimate', description: 'Use your own labour, materials, plant and subcontract rates. Allow for preliminaries, overheads, risk and profit, then check the total.', detail: 'Quantities × rates; preliminaries as priced lines or a percentage.' },
  { number: '03', title: 'Sequence the job.', label: 'Programme', description: 'Set working days and the order of work. Adjust durations to suit the site, suppliers and client; use finish-to-start links in the detailed planner.', detail: 'Working calendars, durations and your schedule overrides.' },
  { number: '04', title: 'Check the proposal.', label: 'Proposal', description: 'Bring your company, scope, price, programme and terms together. Read the whole proposal before sharing it.', detail: 'A branded document and draft PDF; downloading sends nothing.' },
] as const;

export function MarketingHeader() {
  return (
    <header className={`${ui.theme} ${ui.header}`}>
      <div className={ui.headerInner}>
        <Link className={ui.brand} href="/" aria-label="Constructa home"><span aria-hidden="true"><BrandMark /></span>constructa</Link>
        <nav aria-label="Main navigation" className={ui.nav}>
          <Link href="/features">Product</Link>
          <Link href="/pricing">Preview access</Link>
          <Link href="/about">About</Link>
          <Link href="/guides">Guides</Link>
        </nav>
        <div className={ui.headerActions}>
          <Link className={ui.applyCta} href="/apply" aria-label="Apply to the founding cohort">Apply <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className={ui.signIn} href="/login">Sign in <ArrowRight size={16} aria-hidden="true" /></Link>
          <MarketingMobileMenu />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className={`${ui.theme} ${ui.footer}`}>
      <div className={ui.footerTop}>
        <Link className={ui.brand} href="/" aria-label="Constructa home"><span aria-hidden="true"><BrandMark /></span>constructa</Link>
        <p>Built around your business.<br />Not the other way around.</p>
        <nav aria-label="Footer navigation">
          <Link href="/features">The product</Link><Link href="/guides">Guides</Link>
          <Link href="/about">About</Link>
          <Link href="/apply">Apply to the founding cohort</Link><Link href="/login">Sign in</Link>
          <Link href="/terms-of-service">Terms</Link><Link href="/privacy-policy">Privacy</Link>
          <Link href="/contact">Get in touch</Link>
        </nav>
      </div>
      <div className={ui.footerBottom}><span>Constructa © 2026</span><span>Phase one review · Company. Price. Programme. Proposal.</span></div>
    </footer>
  );
}

function FoundingCohortApplyLink({ children = 'Apply to the founding cohort' }: { children?: React.ReactNode }) {
  return <Link className={ui.primary} href="/apply">{children}<ArrowRight size={18} aria-hidden="true" /></Link>;
}

function SignInLink({ children = 'Sign in' }: { children?: React.ReactNode }) {
  return <Link className={ui.signIn} href="/login">{children}<ArrowRight size={16} aria-hidden="true" /></Link>;
}

function ProposalIllustration() {
  return (
    <figure className={ui.visual} aria-label="Illustrative proposal for a kitchen refurbishment, not a live project">
      <div className={ui.visualHeader}><span><i /> A clearer first impression</span><span>Illustrative example</span></div>
      <div className={ui.paper}>
        <div className={ui.paperTop}><strong>Oak &amp; Stone</strong><span>PROPOSAL / 001</span></div>
        <p className={ui.paperKicker}>Built on the details.</p>
        <h2>A kitchen.<br />A fresh start.</h2>
        <p className={ui.paperIntro}>Kitchen refurbishment<br />Prepared for Alex &amp; Sam</p>
        <div className={ui.paperLines}>
          <div><span>Preparation &amp; removal</span><strong>£1,850</strong></div>
          <div><span>Installation &amp; services</span><strong>£8,400</strong></div>
          <div><span>Finishing works</span><strong>£2,200</strong></div>
          <div><span>Total before VAT</span><strong>£12,450</strong></div>
        </div>
        <div className={ui.paperProgramme} aria-hidden="true"><span>Prepare</span><i /><span>Install</span><i /><span>Finish</span><i /></div>
        <div className={ui.paperBottom}><span>Your work. Clearly presented.</span><Check size={17} aria-hidden="true" /></div>
      </div>
      <figcaption>From the first conversation to a proposal that feels like you.</figcaption>
    </figure>
  );
}

function Journey() {
  return (
    <section id="how-it-works" className={ui.section} data-reveal>
      <div className={ui.sectionIntro}><p className={ui.eyebrow}>One connected journey</p><h2>From scope and rates.<br />To a checked proposal.</h2><p>Brief the work, price it with your own figures, set the sequence and check the proposal. Your company story stays alongside the numbers.</p></div>
      <ol className={ui.journey}>
        {stages.map(stage => <li key={stage.number}>
          <div className={ui.stageTop}><span>{stage.number}</span><span>{stage.label}</span></div>
          <h3>{stage.title}</h3><p>{stage.description}</p><small>{stage.detail}</small>
        </li>)}
      </ol>
    </section>
  );
}

function Scope({ showAccessLink = true }: { showAccessLink?: boolean }) {
  return (
    <section id="phase-one" className={`${ui.section} ${ui.scope}`} data-reveal>
      <div><p className={ui.eyebrow}>A focused first release</p><h2>The work-winning essentials.<br />Not a catalogue of add-ons.</h2><p>This phase-one preview brings together company profiles, estimating, programmes and proposals — the essentials for winning work, in one connected flow. It is a working review, not a claim that every part is ready for release.</p></div>
      <div className={ui.scopeList}>
        {['Company profile and past work', 'Job brief and estimating', 'Programme and proposal preparation'].map(item => <p key={item}><Check size={18} aria-hidden="true" />{item}</p>)}
        <p className={ui.scopeNote}>Later-phase delivery, finance and resource tools are outside this preview. No add-on checkout is offered here.</p>
        {showAccessLink && <Link href="/pricing" className={ui.textLink}>About preview access <ArrowRight size={16} aria-hidden="true" /></Link>}
      </div>
    </section>
  );
}

function Questions() {
  const questions = [
    ['Who is Constructa for?', 'Small and medium construction businesses working for domestic and commercial clients. Your company description and your own work remain the starting point.'],
    ['Does Constructa price the job for me?', 'No. Use your own labour, materials, plant and subcontract rates. Constructa organises the figures; you check the scope, allowances and total before relying on an estimate.'],
    ['Does a longer programme update my preliminaries?', 'No. Review time-related costs yourself when dates or durations change. You can price preliminaries as lines or use a percentage; the programme does not automatically reprice them.'],
    ['Is the AI chat assistant available?', 'A contextual assistant for estimating and planning is part of the development work. It is not available as a live chatbot in this preview. Existing assisted-writing controls are separate and depend on their own availability.'],
    ['Can I buy the later-phase tools here?', 'No. This preview focuses on the work-winning journey. Later-phase workflows and commercial plans are not being offered for purchase here.'],
    ['Is this ready for live customer work?', 'This is a pre-release review. Authentication, data handling, commercial terms and the complete proposal journey are being verified before live customer use.'],
  ];
  return <section id="questions" className={`${ui.section} ${ui.questions}`} data-reveal><div><p className={ui.eyebrow}>A few useful answers</p><h2>Before you<br />get started.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>;
}

function Invitation() {
  return (
    <section className={ui.invitation} data-reveal>
      <p className={ui.eyebrow}>Your next chapter</p>
      <h2>Good work deserves<br />a good introduction.</h2>
      <p>Start with your business. Bring the next job into focus.</p>
      <div className={ui.actions} style={{ justifyContent: 'center' }}>
        <FoundingCohortApplyLink />
        <SignInLink>Existing account? Sign in</SignInLink>
      </div>
      <small>Founding cohort planned for 7 December 2026, subject to release approval. Apply is separate from sign-in. This preview does not take a payment.</small>
    </section>
  );
}

export function PhaseOneHome() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section id="marketing-content" className={ui.hero}>
        <div className={ui.heroCopy}><p className={ui.eyebrow}><span className={ui.dot} /> Made for the way you win work</p>
          <h1>Price the work.<br />Plan the job.<br /><em>Check the proposal.</em></h1>
          <p className={ui.lede}>Constructa helps UK contractors organise the scope, quantities and rates behind an estimate, set out a programme and prepare a proposal. Your figures stay yours; you check what goes to the client.</p>
          <div className={ui.actions}>
            <FoundingCohortApplyLink />
            <SignInLink />
            <Link className={ui.textLink} href="#how-it-works">See how it connects <ArrowDown size={17} aria-hidden="true" /></Link>
          </div>
          <p className={ui.reviewNote}>Founding cohort planned for 7 December 2026, subject to release approval.</p>
          <p className={ui.reviewNote}>Phase one review · Built for domestic and commercial contractors</p>
        </div>
        <ProposalIllustration />
      </section>
      <div className={ui.chapterLine}><span>Built around your business</span><span>Company <i /> Price <i /> Programme <i /> Proposal</span></div>
      <Journey />
      <HomeReviewCaptures />
      <section className={`${ui.section} ${ui.story}`} data-reveal>
        <div className={ui.photo}><HomeBusinessVisual /><span>Construction is a people business.</span></div>
        <div><p className={ui.eyebrow}>The experience behind the estimate</p><h2>Your business.<br />Not another<br />blank template.</h2><p>Your experience, the challenges you have solved and the quality of your work belong alongside the numbers. Put them in a company profile and reuse the right examples when you prepare a proposal.</p><p>Whether you fit kitchens, refurbish workplaces or run a multi-trade team, the story should be yours.</p><FoundingCohortApplyLink>Apply for the founding cohort</FoundingCohortApplyLink></div>
      </section>
      <Scope /><Questions /><Invitation /><NewsletterSignup />
    </div>
  );
}

export function PhaseOneFeatures() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section className={ui.pageIntro} data-reveal>
        <p className={ui.eyebrow}>The phase-one product</p>
        <h1>From first hello.<br /><em>To a considered proposal.</em></h1>
        <p>Start with your company and the job brief. Build quantities × rates, allow for preliminaries and risk, then set working days and sequence. Review the resulting proposal and draft PDF before sharing anything.</p>
        <p>The contextual assistant is not available as a live chatbot in this preview.</p>
        <div className={ui.actions}>
          <FoundingCohortApplyLink />
          <SignInLink />
          <Link className={ui.textLink} href="/#how-it-works">See how the journey connects <ArrowDown size={17} aria-hidden="true" /></Link>
        </div>
      </section>
      <ProductReviewGuide /><ProductScreenshots /><Invitation />
    </div>
  );
}

export function PhaseOnePricing() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <section className={ui.pageIntro} data-reveal>
        <p className={ui.eyebrow}>Preview access</p>
        <h1>A focused first phase.<br /><em>No add-on checkout.</em></h1>
        <p>We are reviewing the complete work-winning journey before release. Preview access is part of the founding-cohort review — no subscription, free trial or payment is offered here.</p>
        <p>Preview access remains on hold for new accounts. This review is not ready for live customer work.</p>
        <p>This preview is for people using an existing review account. Sign in with the details you were given, then start with your company profile.</p>
        <div className={ui.actions}>
          <FoundingCohortApplyLink />
          <SignInLink>Sign in with your review account</SignInLink>
          <Link href="/features" className={ui.textLink}>Explore the phase-one scope <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <p>
          Want access but not signed in yet? <Link href="/apply" className={ui.textLink}>Apply to the founding cohort <ArrowRight size={16} aria-hidden="true" /></Link>
          {' · '}
          <Link href="/contact" className={ui.textLink}>Questions about preview access <ArrowRight size={16} aria-hidden="true" /></Link>
        </p>
        <p>
          The full picture lives on the home page:{' '}
          <Link href="/#phase-one" className={ui.textLink}>the work-winning essentials <ArrowRight size={16} aria-hidden="true" /></Link>
          {' · '}
          <Link href="/#questions" className={ui.textLink}>preview questions <ArrowRight size={16} aria-hidden="true" /></Link>
        </p>
      </section>
      <FoundingCohortPricingPanel />
    </div>
  );
}
