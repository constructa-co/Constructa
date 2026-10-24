import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, Plus } from 'lucide-react';
import ui from './phase-one.module.css';

const stages = [
  { number: '01', title: 'Make it your business.', label: 'Company', description: 'Introduce your company, your experience and the work you are proud of. Build a profile you can use again.', detail: 'Company details, your story and case studies.' },
  { number: '02', title: 'Put a price to the work.', label: 'Estimate', description: 'Describe the job, build your price lines and see how the total comes together. Your scope and your numbers, in one place.', detail: 'One-price items, quantities, rates and adjustments.' },
  { number: '03', title: 'Give the job a plan.', label: 'Programme', description: 'Set out when the work starts, how long it takes and the stages along the way. Give the client a clearer picture.', detail: 'Start dates, durations and a visual programme.' },
  { number: '04', title: 'Present the whole picture.', label: 'Proposal', description: 'Bring your business, scope, price, programme and terms together. Check the finished proposal before sharing it.', detail: 'A branded document, a draft PDF and client response options.' },
] as const;

export function MarketingHeader() {
  return (
    <header className={`${ui.theme} ${ui.header}`}>
      <div className={ui.headerInner}>
        <Link className={ui.brand} href="/" aria-label="Constructa home"><span aria-hidden="true">C</span>constructa</Link>
        <nav aria-label="Main navigation" className={ui.nav}>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/features">The product</Link>
          <Link href="/pricing">Preview access</Link>
        </nav>
        <Link className={ui.signIn} href="/login">Sign in <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className={`${ui.theme} ${ui.footer}`}>
      <div className={ui.footerTop}>
        <Link className={ui.brand} href="/" aria-label="Constructa home"><span aria-hidden="true">C</span>constructa</Link>
        <p>Built around your business.<br />Not the other way around.</p>
        <nav aria-label="Footer navigation">
          <Link href="/features">The product</Link><Link href="/login">Sign in</Link>
          <Link href="/terms-of-service">Terms</Link><Link href="/privacy-policy">Privacy</Link>
          <a href="mailto:hello@constructa.co">Get in touch</a>
        </nav>
      </div>
      <div className={ui.footerBottom}><span>Constructa © 2026</span><span>Phase one review · Company. Price. Programme. Proposal.</span></div>
    </footer>
  );
}

function AccountLink({ children = 'Open Constructa' }: { children?: React.ReactNode }) {
  return <Link className={ui.primary} href="/login">{children}<ArrowRight size={18} aria-hidden="true" /></Link>;
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
    <section id="how-it-works" className={ui.section}>
      <div className={ui.sectionIntro}><p className={ui.eyebrow}>One connected journey</p><h2>Less starting again.<br />More moving forward.</h2><p>From who you are to what you will deliver. Keep the company story, the job and the proposal connected.</p></div>
      <ol className={ui.journey}>
        {stages.map(stage => <li key={stage.number}>
          <div className={ui.stageTop}><span>{stage.number}</span><span>{stage.label}</span><ArrowRight size={17} aria-hidden="true" /></div>
          <h3>{stage.title}</h3><p>{stage.description}</p><small>{stage.detail}</small>
        </li>)}
      </ol>
    </section>
  );
}

function Scope({ showAccessLink = true }: { showAccessLink?: boolean }) {
  return (
    <section id="phase-one" className={`${ui.section} ${ui.scope}`}>
      <div><p className={ui.eyebrow}>A focused first release</p><h2>The work-winning essentials.<br />Not a catalogue of add-ons.</h2><p>This phase-one preview brings together company profiles, estimating, programmes and proposals. It is a working review, not a claim that every part is ready for release.</p></div>
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
    ['Can I use my own prices and company details?', 'Yes. Add your business details and past work, describe the job and enter your price lines. Check the scope, programme and terms for each proposal before sharing it.'],
    ['Is the AI chat assistant available?', 'A contextual assistant for estimating and planning is part of the development work. It is not available as a live chatbot in this preview. Existing assisted-writing controls are separate and depend on their own availability.'],
    ['Can I buy the later-phase tools here?', 'No. This preview focuses on the work-winning journey. Later-phase workflows and commercial plans are not being offered for purchase here.'],
    ['Is this ready for live customer work?', 'This is a phase-one review. Authentication, data handling, commercial terms and the complete proposal journey need release verification before live customer use.'],
  ];
  return <section className={`${ui.section} ${ui.questions}`}><div><p className={ui.eyebrow}>A few useful answers</p><h2>Before you<br />get started.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>;
}

function Invitation() {
  return <section className={ui.invitation}><p className={ui.eyebrow}>Your next chapter</p><h2>Good work deserves<br />a good introduction.</h2><p>Start with your business. Bring the next job into focus.</p><AccountLink /><small>Account entry opens here. This preview does not take a payment.</small></section>;
}

export function PhaseOneHome() {
  return (
    <div className={`${ui.theme} ${ui.root}`}>
      <a href="#marketing-content" className={ui.skip}>Skip to content</a>
      <section id="marketing-content" className={ui.hero}>
        <div className={ui.heroCopy}><p className={ui.eyebrow}><span className={ui.dot} /> Made for the way you win work</p>
          <h1>Good work.<br />Clearly priced.<br /><em>Better presented.</em></h1>
          <p className={ui.lede}>Give your business the introduction it deserves. Bring your company, your price and your programme into a proposal worth putting your name to.</p>
          <div className={ui.actions}><AccountLink /><Link className={ui.textLink} href="#how-it-works">See how it connects <ArrowDown size={17} aria-hidden="true" /></Link></div>
          <p className={ui.reviewNote}>Phase one review · Built for domestic and commercial contractors</p>
        </div>
        <ProposalIllustration />
      </section>
      <div className={ui.chapterLine}><span>Built around your business</span><span>Company <i /> Price <i /> Programme <i /> Proposal</span></div>
      <Journey />
      <section className={`${ui.section} ${ui.story}`}>
        <div className={ui.photo}><Image src="/images/about-hero.png" alt="Construction team reviewing plans together" width={2048} height={2048} sizes="(max-width: 800px) 100vw, 45vw" /><span>Construction is a people business.</span></div>
        <div><p className={ui.eyebrow}>The experience behind the estimate</p><h2>Your business.<br />Not another<br />blank template.</h2><p>Your experience, the challenges you have solved and the quality of your work belong alongside the numbers. Put them in a company profile and reuse the right examples when you prepare a proposal.</p><p>Whether you fit kitchens, refurbish workplaces or run a multi-trade team, the story should be yours.</p><AccountLink>Start with your business</AccountLink></div>
      </section>
      <Scope /><Questions /><Invitation />
    </div>
  );
}

export function PhaseOneFeatures() {
  return <div className={`${ui.theme} ${ui.root}`}><section className={ui.pageIntro}><p className={ui.eyebrow}>The phase-one product</p><h1>From first hello.<br /><em>To a considered proposal.</em></h1><p>One connected work-winning journey. Company profile, brief, price, programme and proposal, with room for your own experience and judgement.</p><AccountLink /></section><Journey /><Scope /><Questions /><Invitation /></div>;
}

export function PhaseOnePricing() {
  return <div className={`${ui.theme} ${ui.root}`}><section className={ui.pageIntro}><p className={ui.eyebrow}>Preview access</p><h1>A focused first phase.<br /><em>No add-on checkout.</em></h1><p>We are reviewing the complete work-winning journey before release. This page does not sell a subscription, promise a free trial or take payment for later-phase features.</p><AccountLink /><Link href="/features" className={ui.textLink}>Explore the phase-one scope <ArrowRight size={16} aria-hidden="true" /></Link></section><Scope showAccessLink={false} /><Questions /></div>;
}
