/**
 * A074 — optional proposal cover image.
 *
 * Contractors may show no cover image (legacy default), their first site photo,
 * or the approved illustrative design render with mandatory labelling.
 */

export const COVER_PRIMARY_SRC = "/Setting us apart.png";
export const COVER_FALLBACK_SRC = "/minimalist infographic cluster of small construction buildings.png";
export const COVER_RENDER_CAPTION = "Illustrative design render — not a photograph of completed work.";
export const COVER_ARTWORK_CAPTION = "Illustrative artwork — not a photograph of completed work.";
export const COVER_RENDER_ALT = "Illustrative render of a project programme board for an office renovation.";
export const COVER_ARTWORK_ALT = "Line-art illustration of construction buildings.";

export type ProposalCoverPhotoChoice = "site" | "illustrative_render";

export interface ProposalCoverPhoto {
    kind: ProposalCoverPhotoChoice;
    url: string;
    alt: string;
    caption: string;
}

export interface ProposalCoverPhotoSiteInput {
    url: string;
    caption?: string | null;
}

export function coverForIllustrativeRender(useFallback = false): ProposalCoverPhoto {
    return useFallback
        ? {
            kind: "illustrative_render",
            url: COVER_FALLBACK_SRC,
            alt: COVER_ARTWORK_ALT,
            caption: COVER_ARTWORK_CAPTION,
        }
        : {
            kind: "illustrative_render",
            url: COVER_PRIMARY_SRC,
            alt: COVER_RENDER_ALT,
            caption: COVER_RENDER_CAPTION,
        };
}

export function parseProposalCoverPhotoChoice(value: unknown): ProposalCoverPhotoChoice | null {
    if (value === "site" || value === "illustrative_render") return value;
    return null;
}

export function resolveProposalCoverPhoto(
    choice: ProposalCoverPhotoChoice | null | undefined,
    sitePhotos: readonly ProposalCoverPhotoSiteInput[] | null | undefined,
): ProposalCoverPhoto | null {
    if (!choice) return null;
    if (choice === "illustrative_render") return coverForIllustrativeRender(false);
    const first = (sitePhotos ?? []).find((photo) => typeof photo?.url === "string" && photo.url.trim());
    if (!first) return null;
    const caption = first.caption?.trim();
    return {
        kind: "site",
        url: first.url.trim(),
        alt: caption ? caption : "Site photograph on the proposal cover",
        caption: caption || "Site photograph.",
    };
}

export const COVER_PHOTO_CHOICE_LABELS: Record<ProposalCoverPhotoChoice, string> = {
    site: "First site photo",
    illustrative_render: "Illustrative design render",
};