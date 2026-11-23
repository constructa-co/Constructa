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
  {
    "slug": "programme-review",
    "title": "Checking a programme before sharing",
    "summary": "Check the working calendar before relying on dates. Working days and calendar days differ; allow for site access, holidays, people and suppliers that affect this job.",
    "intro": "Check the working calendar before relying on dates. Working days and calendar days differ; allow for site access, holidays, people and suppliers that affect this job.",
    "previewNote": "For existing phase-one review accounts. Check your own work before sharing.",
    "steps": [
      {
        "title": "Practical checklist",
        "add": [
          "Read the sequence stage by stage. Where work overlaps, review the actual scheduled start and finish dates rather than adding every stage duration together. Use the existing scheduling controls and check any finish-to-start dependencies against the way the job will be delivered.",
          "A stage marked as finishing in the final week is not a critical-path calculation. The marker does not establish float or tell you the consequences of every delay. Review what a slipped activity affects yourself.",
          "Changing the programme does not automatically reprice time-related preliminaries. If the job becomes longer or shorter, revisit those estimate lines and check the revised scope and total before sharing anything."
        ],
        "get": [
          "Your own review of the information you intend to share."
        ],
        "check": "Finally, read the programme as your client or site lead would. Does the order make sense? Are durations realistic? Does the plan include work that has not been priced? Keep the estimate, programme and proposal consistent through your own review."
      }
    ],
    "closingChecks": [
      "Dates and sequence are realistic and consistent with the checked estimate."
    ]
  ,
    ...GUIDE_ARTICLE_ATTRIBUTION
  },
  {
    "slug": "company-profile",
    "title": "Keeping your company profile accurate",
    "summary": "Your company profile helps explain who will do the work. Review the company details, insurance, accreditations, specialisms and past jobs you enter. Constructa does not verify credentials for you; check each statement against your own current records.",
    "intro": "Your company profile helps explain who will do the work. Review the company details, insurance, accreditations, specialisms and past jobs you enter. Constructa does not verify credentials for you; check each statement against your own current records.",
    "previewNote": "For existing phase-one review accounts. Check your own work before sharing.",
    "steps": [
      {
        "title": "Practical checklist",
        "add": [
          "Check that the company name, address and logo match your current trading details.",
          "Review insurance and accreditation entries. Describe their current status accurately; do not imply cover or membership you cannot substantiate.",
          "List specialisms that reflect work you actually undertake.",
          "Choose relevant past work rather than presenting every job. Consider similar trades, scale and setting, and describe your own role accurately.",
          "Use project descriptions and images you have permission to use. Do not invent a client quote or testimonial.",
          "Read the profile as it appears in the proposal, not just in the input fields. Check that the examples included suit this job."
        ],
        "get": [
          "Your own review of the information you intend to share."
        ],
        "check": "This guide is for existing review accounts. Full photo and library journeys remain outside this preview. Check your saved company information and the actual proposal before sharing."
      },
      {
        "title": "Worked example",
        "add": [
          "For a bathroom refurbishment, a comparable residential project may explain your experience more clearly than an unrelated large commercial job. Describe the work and setting factually; do not imply that every future job will have the same result."
        ],
        "get": [
          "Your own review of the information you intend to share."
        ],
        "check": "Describe your own role accurately and use only past-work examples you can substantiate."
      }
    ],
    "closingChecks": [
      "Company statements and past-work examples match current records."
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
