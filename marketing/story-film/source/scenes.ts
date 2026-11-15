/**
 * Editable scene timing and copy for the 38-second Constructa story film.
 * Times are seconds from the start of the film.
 */
export const STORY_FILM_DURATION_S = 38;

export type StoryFilmScene = {
  id: string;
  start: number;
  end: number;
  label: string;
  headline: string;
  caption?: string;
};

export const STORY_FILM_SCENES: StoryFilmScene[] = [
  {
    id: "after-hours",
    start: 0,
    end: 5,
    label: "After hours",
    headline: "Another evening on the quote?",
    caption: "Messages, spreadsheets and marked-up sketches",
  },
  {
    id: "promise",
    start: 5,
    end: 9,
    label: "Promise",
    headline: "Good work. Clearly priced. Better presented.",
    caption: "The paperwork settles into one clear page",
  },
  {
    id: "company",
    start: 9,
    end: 13,
    label: "Company",
    headline: "Company",
    caption: "Your name, brand and credentials in one profile",
  },
  {
    id: "brief",
    start: 13,
    end: 17,
    label: "Brief",
    headline: "Brief",
    caption: "Rear kitchen extension — scope from sketch and notes",
  },
  {
    id: "estimate",
    start: 17,
    end: 22,
    label: "Estimate",
    headline: "£48,500",
    caption: "Illustrative estimate · Foundations, steel and roof",
  },
  {
    id: "programme",
    start: 22,
    end: 27,
    label: "Programme",
    headline: "Programme",
    caption: "Groundworks through shell and finishes",
  },
  {
    id: "proposal",
    start: 27,
    end: 33,
    label: "Proposal",
    headline: "Proposal",
    caption: "Cover, scope, pricing and programme in one document",
  },
  {
    id: "end-card",
    start: 33,
    end: 38,
    label: "End card",
    headline: "Apply to the founding cohort.",
    caption: "constructa",
  },
];

export const STORY_FILM_BRAND = {
  base: "#101211",
  panel: "#191f1b",
  line: "#343e36",
  ink: "#f4f2ed",
  muted: "#a7b0a9",
  accent: "#c9efcf",
  accentInk: "#182c1b",
} as const;