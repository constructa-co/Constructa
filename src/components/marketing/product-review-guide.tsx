import Link from 'next/link';
import { ArrowRight, Check, Pause } from 'lucide-react';
import ui from './phase-one.module.css';
import guide from './product-review-guide.module.css';

const steps = [
  {
    number: '01',
    title: 'Company',
    add: ['Company name, trading address and logo', 'Insurance details and accreditations', 'Specialisms, capability statement and past jobs'],
    get: ['A saved company profile', 'Business details ready to draw into each proposal'],
    check: 'Your company details are current and each past job suits the proposal it appears in.',
  },
  {
    number: '02',
    title: 'Brief and price',
    add: ['The job in your own words, with the trades involved', 'Access, restrictions, assumptions and a likely start date', 'One-price items, quantities and rates'],
    get: ['A job brief', 'Price lines with a running total', 'Exclusions and clarifications kept with the job'],
    check: 'The scope, quantities, rates and total are the ones you intend to stand behind.',
  },
  {
    number: '03',
    title: 'Programme',
    add: ['A target start date, or working days from Day 1', 'How long the job takes', 'Optional stages and working days'],
    get: ['A programme at a glance', 'A finish date, or a finish day when the start is not known'],
    check: 'The dates, working days and stage order are realistic for this job.',
  },
  {
    number: '04',
    title: 'Proposal',
    add: ['Payment stages', 'How many days the price is valid for', 'The terms for this proposal'],
    get: ['An on-screen preview of the proposal', 'A PDF marked as a draft. Downloading it sends nothing'],
    check: 'Read the whole preview. Client response options ask for receipt or a non-binding intention to proceed, and neither is acceptance.',
  },
] as const;

const reviewable = [
  'How company details carry into a proposal',
  'How a brief and price lines build to a total',
  'How the programme sits beside the price',
  'How the proposal reads on screen and as a draft PDF',
] as const;

const held = [
  'Live AI assistance, including any AI chat assistant',
  'New account sign-up',
  'Release for real customers and live jobs',
  'Checkout, subscriptions and payment',
  'Complete photo, consent and recovery journeys',
  'Security certification. None is claimed',
] as const;

function GuideList({ items }: { items: readonly string[] }) {
  return <ul className={guide.detailList}>{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

export function ProductReviewGuide() {
  return (
    <section id="product-review-guide" aria-labelledby="product-review-guide-title" className={`${ui.section} ${guide.guide}`}>
      <div className={ui.sectionIntro}>
        <p className={ui.eyebrow}>Product review guide</p>
        <h2 id="product-review-guide-title">What goes in.<br />What comes out.</h2>
        <p>Each step shows what you add, what you get and what to check yourself before anything is shared.</p>
      </div>

      <ol className={guide.steps}>
        {steps.map(step => (
          <li key={step.number} className={guide.step}>
            <div className={guide.stepTitle}><span>{step.number}</span><h3>{step.title}</h3></div>
            <dl className={guide.details}>
              <div><dt>You add</dt><dd><GuideList items={step.add} /></dd></div>
              <div><dt>You get</dt><dd><GuideList items={step.get} /></dd></div>
              <div><dt>Check before sharing</dt><dd>{step.check}</dd></div>
            </dl>
          </li>
        ))}
      </ol>

      <div className={guide.boundary}>
        <div>
          <h3>What you can review</h3>
          <p>In this phase-one preview, using an existing review account.</p>
          <ul>{reviewable.map(item => <li key={item}><Check size={18} aria-hidden="true" />{item}</li>)}</ul>
        </div>
        <div className={guide.held}>
          <h3>Held back from this preview</h3>
          <p>These are not part of what you are being asked to review or rely on.</p>
          <ul>{held.map(item => <li key={item}><Pause size={18} aria-hidden="true" />{item}</li>)}</ul>
        </div>
      </div>

      <div className={guide.nextSteps}>
        <h3>Your next step</h3>
        <div>
          <p>Already have a review account? Sign in and start with your company profile.</p>
          <Link className={ui.textLink} href="/login">Sign in to Constructa <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div>
          <p>No account yet? Read what preview access does and does not include.</p>
          <Link className={ui.textLink} href="/pricing">How preview access works <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
