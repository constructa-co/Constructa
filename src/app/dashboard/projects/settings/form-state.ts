export const SETTINGS_LEAVE_WARNING = "Your project settings have changes that are not confirmed saved.\n\nPress Cancel to stay here, or OK to leave without saving them.";

export function settingsFormSignature(data: FormData): string {
    return JSON.stringify(Array.from(data.entries(), ([name, value]) => [name, String(value)]));
}
