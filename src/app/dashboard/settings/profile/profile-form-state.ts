export const PROFILE_LEAVE_WARNING = "Your profile has unsaved changes or a save that is not yet confirmed. Leave this page?";
export const PROFILE_SAVE_UNCONFIRMED = "We couldn't confirm that your profile was saved. Your edits are still here; check your connection and try again.";

/** Compare the complete submitted payload, without changing or normalising its values. */
export function profileFormSignature(data: FormData): string {
    return JSON.stringify(Array.from(data.entries(), ([name, value]) => [name,
        typeof value === "string" ? value : { name: value.name, size: value.size, type: value.type },
    ] as const).sort(([left], [right]) => left.localeCompare(right)));
}

export async function attemptProfileSave(
    save: (data: FormData) => Promise<{ success: boolean; error?: string }>,
    data: FormData,
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await save(data);
        return result?.success ? result : { success: false, error: result?.error || PROFILE_SAVE_UNCONFIRMED };
    } catch {
        return { success: false, error: PROFILE_SAVE_UNCONFIRMED };
    }
}
