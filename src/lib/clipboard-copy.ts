// E2E-02 — clipboard writes can hang indefinitely (pending permission
// prompts, headless browsers) or be unavailable entirely. Coupling that to
// the publish busy-state left the "Publish & Copy Link" button stuck on
// "Publishing..." after the immutable publication had already committed.
// This helper bounds the write with a timeout and reports the outcome so
// the caller can always clear its busy state and fall back to showing the
// URL for manual copy — never republishing just because the copy failed.

export type ClipboardCopyOutcome = "copied" | "failed" | "unavailable" | "timeout";

export const CLIPBOARD_COPY_TIMEOUT_MS = 3000;

export async function copyTextWithFallback(
    text: string,
    options: {
        writeText?: (text: string) => Promise<void>;
        timeoutMs?: number;
    } = {},
): Promise<ClipboardCopyOutcome> {
    const writeText =
        options.writeText ??
        (typeof navigator !== "undefined" && navigator.clipboard
            ? navigator.clipboard.writeText.bind(navigator.clipboard)
            : undefined);
    if (!writeText) return "unavailable";

    let write: Promise<void>;
    try {
        write = Promise.resolve(writeText(text));
    } catch {
        return "failed";
    }
    // A write that settles after the timeout has already lost the race;
    // swallow its rejection so it never surfaces as an unhandled rejection.
    write.catch(() => {});

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), options.timeoutMs ?? CLIPBOARD_COPY_TIMEOUT_MS);
    });

    const outcome = await Promise.race([
        write.then(
            () => "copied" as const,
            () => "failed" as const,
        ),
        timeout,
    ]);
    if (timer) clearTimeout(timer);
    return outcome;
}
