let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Loads PDF.js only when a deferred document tool is opened and keeps the
 * worker on Constructa's own origin. The prior unpkg URL executed third-party
 * code inside the authenticated application and made parsing depend on a CDN.
 */
export function loadClientPdfJs(): Promise<typeof import("pdfjs-dist")> {
    if (!pdfJsPromise) {
        pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.min.mjs",
                import.meta.url,
            ).toString();
            return pdfjs;
        });
    }

    return pdfJsPromise;
}
