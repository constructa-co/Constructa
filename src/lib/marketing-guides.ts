export type GuideStepBlock = {
  title: string;
  add: readonly string[];
  get: readonly string[];
  check: string;
};

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  previewNote: string;
  steps: readonly GuideStepBlock[];
  closingChecks: readonly string[];
};

const companyStep: GuideStepBlock = {
  title: 'Company',
  add: [
    'Company name, trading address and logo',
    'Insurance details and accreditations',
    'Specialisms, capability statement and past jobs',
  ],
  get: ['A saved company profile', 'Business details ready to draw into each proposal'],
  check: 'Your company details are current and each past job suits the proposal it appears in.',
};

const briefPriceStep: GuideStepBlock = {
  title: 'Brief and price',
  add: [
    'The job in your own words, with the trades involved',
    'Access, restrictions, assumptions and a likely start date',
    'One-price items, quantities and rates',
  ],
  get: [
    'A job brief',
    'Price lines with a running total',
    'Exclusions and clarifications kept with the job',
  ],
  check: 'The scope, quantities, rates and total are the ones you intend to stand behind.',
};

const programmeStep: GuideStepBlock = {
  title: 'Programme',
  add: [
    'A target start date, or working days from Day 1',
    'How long the job takes',
    'Optional stages and working days',
  ],
  get: [
    'A programme at a glance',
    'A finish date, or a finish day when the start is not known',
  ],
  check: 'The dates, working days and stage order are realistic for this job.',
};

const proposalStep: GuideStepBlock = {
  title: 'Proposal',
  add: ['Payment stages', 'How many days the price is valid for', 'The terms for this proposal'],
  get: [
    'An on-screen preview of the proposal',
    'A PDF marked as a draft. Downloading it sends nothing',
  ],
  check:
    'Read the whole preview. Client response options ask for receipt or a non-binding intention to proceed, and neither is acceptance.',
};

export const GUIDE_ARTICLES: readonly GuideArticle[] = [
  {
    slug: 'review-brief-and-price',
    title: 'Review your company profile, brief and price',
    summary:
      'What to add and what to check on company details, scope and price lines before you move on in a phase-one review.',
    intro:
      'These notes follow the same connected journey as the product review guide on the phase-one product page. They are for checking your own work while using an existing review account — not for live customer jobs or release claims.',
    previewNote: 'In this phase-one preview, using an existing review account.',
    steps: [companyStep, briefPriceStep],
    closingChecks: [
      'Your company details are current and each past job suits the proposal it appears in.',
      'The scope, quantities, rates and total are the ones you intend to stand behind.',
    ],
  },
  {
    slug: 'programme-and-proposal-before-sharing',
    title: 'Check programme and proposal before sharing',
    summary:
      'How to read the programme beside the price and review the on-screen proposal and draft PDF before anything leaves your desk.',
    intro:
      'Use this when the price lines are in place and you are checking timing and the finished proposal. Held items such as live AI assistance, new sign-up, payments and complete photo or consent journeys are not part of this preview.',
    previewNote: 'In this phase-one preview, using an existing review account.',
    steps: [programmeStep, proposalStep],
    closingChecks: [
      'The dates, working days and stage order are realistic for this job.',
      'Read the whole preview. Client response options ask for receipt or a non-binding intention to proceed, and neither is acceptance.',
      'A PDF marked as a draft. Downloading it sends nothing.',
    ],
  },
] as const;

export function getGuideArticle(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find(article => article.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return GUIDE_ARTICLES.map(article => article.slug);
}
