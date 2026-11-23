export type GuideStepBlock = {
  title: string;
  add: readonly string[];
  get: readonly string[];
  check: string;
};

/** Shared attribution for phase-one preview guides — AI-assisted, not expert-reviewed. */
export const GUIDE_ARTICLE_ATTRIBUTION = {
  author: 'Constructa',
  preparation: 'AI-assisted draft guidance',
  contentUpdatedIso: '2026-11-23',
  contentUpdatedDisplay: '23 November 2026',
} as const;

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  previewNote: string;
  author: string;
  preparation: string;
  contentUpdatedIso: string;
  contentUpdatedDisplay: string;
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
      'These notes follow the same connected journey as the product review guide on the phase-one product page. They are for checking your own work while using an existing review account.',
    previewNote: 'In this phase-one preview, using an existing review account.',
    ...GUIDE_ARTICLE_ATTRIBUTION,
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
    ...GUIDE_ARTICLE_ATTRIBUTION,
    steps: [programmeStep, proposalStep],
    closingChecks: [
      'The dates, working days and stage order are realistic for this job.',
      'Read the whole preview. Client response options ask for receipt or a non-binding intention to proceed, and neither is acceptance.',
      'A PDF marked as a draft. Downloading it sends nothing.',
    ],
  },
  {
    "slug": "estimate-review",
    "title": "Checking an estimate before sharing",
    "summary": "Start with your quantities and rates. Read each description, unit, quantity and rate against the work you intend to include. Constructa organises your figures; it does not measure drawings or price the job for you.",
    "intro": "Start with your quantities and rates. Read each description, unit, quantity and rate against the work you intend to include. Constructa organises your figures; it does not measure drawings or price the job for you.",
    "previewNote": "For existing phase-one review accounts. Check your own work before sharing.",
    "steps": [
      {
        "title": "Practical checklist",
        "add": [
          "Keep credits visible. A credit is a deduction or adjustment reducing the price, not a nominated-supplier allowance. Check its sign, description and effect on the total, and confirm it appears where you intend in the proposal.",
          "Review any prime-cost or provisional-sum allowances you have entered separately from credits. Make their descriptions and exclusions clear and check the figures you have entered. This guide does not decide their contractual treatment.",
          "Read preliminaries, overheads, risk and profit alongside the work items. Check whether preliminaries are explicit lines or percentage based. If the programme changes, revisit time-related preliminaries yourself; changing dates does not automatically reprice them."
        ],
        "get": [
          "Your own review of the information you intend to share."
        ],
        "check": "Check the sections and final total independently. Review the VAT treatment against the job and your own verified information. Read the proposal preview and draft PDF before sharing. Downloading the draft PDF sends nothing. This is practical checking guidance, not tax or legal advice."
      }
    ],
    "closingChecks": [
      "Credits, allowances and the final total reflect the work you priced."
    ]
  ,
    ...GUIDE_ARTICLE_ATTRIBUTION
  },
] as const;

export function getGuideArticle(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find(article => article.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return GUIDE_ARTICLES.map(article => article.slug);
}
