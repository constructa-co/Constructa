export const OMIT_PROGRAMME = { programmeIntent: "omit", intent_version: 1 } as const;

export function readProgrammeInclusion(value: unknown): { intent: "include" | "omit" | "invalid"; phases: unknown[] } {
    if (value == null) return { intent: "include", phases: [] };
    if (!Array.isArray(value)) return { intent: "invalid", phases: [] };
    const markers = value.filter(p => p && typeof p === "object" && Object.hasOwn(p, "programmeIntent"));
    if (!markers.length) return { intent: "include", phases: value };
    const marker = markers[0];
    if (markers.length !== 1 || value[value.length - 1] !== marker || Object.keys(marker).length !== 2
        || marker.programmeIntent !== "omit" || marker.intent_version !== 1) return { intent: "invalid", phases: value };
    return { intent: "omit", phases: value.slice(0, -1) };
}

/** Metadata is separate from the activities; restoring never regenerates them. */
export function withProgrammeInclusion(value: unknown, include: boolean): unknown[] {
    const read = readProgrammeInclusion(value);
    if (read.intent === "invalid") throw new Error("Check the saved programme choice before changing it.");
    return include ? [...read.phases] : [...read.phases, { ...OMIT_PROGRAMME }];
}
