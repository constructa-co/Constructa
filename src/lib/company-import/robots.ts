/**
 * Just enough of the robots exclusion protocol to decide whether a path may
 * be read. The file is untrusted text: it is only ever matched against paths.
 */

export const IMPORT_USER_AGENT = "ConstructaProfileImport";

interface Rule {
    allow: boolean;
    pattern: string;
}

function rulesFor(robotsTxt: string, agent: string): Rule[] {
    const groups: { agents: string[]; rules: Rule[] }[] = [];
    let current: { agents: string[]; rules: Rule[] } | null = null;
    let lastWasAgent = false;

    for (const rawLine of robotsTxt.split(/\r?\n/).slice(0, 2000)) {
        const line = rawLine.replace(/#.*$/, "").trim();
        const colon = line.indexOf(":");
        if (colon < 1) continue;
        const key = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();

        if (key === "user-agent") {
            if (!current || !lastWasAgent) {
                current = { agents: [], rules: [] };
                groups.push(current);
            }
            current.agents.push(value.toLowerCase());
            lastWasAgent = true;
        } else if ((key === "allow" || key === "disallow") && current) {
            // An empty Disallow means nothing is disallowed.
            if (value) current.rules.push({ allow: key === "allow", pattern: value.slice(0, 500) });
            lastWasAgent = false;
        } else {
            lastWasAgent = false;
        }
    }

    const named = groups.filter((group) => group.agents.includes(agent.toLowerCase()));
    const chosen = named.length > 0 ? named : groups.filter((group) => group.agents.includes("*"));
    return chosen.flatMap((group) => group.rules);
}

/** `*` matches any run of characters and a trailing `$` anchors the end. No regular expression is built from the file. */
function matches(pattern: string, path: string): boolean {
    const anchored = pattern.endsWith("$");
    const parts = (anchored ? pattern.slice(0, -1) : pattern).split("*");
    let position = 0;
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (index === 0) {
            if (!path.startsWith(part)) return false;
            position = part.length;
            continue;
        }
        const last = index === parts.length - 1;
        if (last && anchored) {
            return part.length <= path.length - position && path.endsWith(part);
        }
        const found = path.indexOf(part, position);
        if (found < 0) return false;
        position = found + part.length;
    }
    return anchored ? position === path.length : true;
}

/** The longest matching rule decides; a tie goes to Allow; no match means allowed. */
export function isPathAllowed(robotsTxt: string, pathAndQuery: string, agent: string = IMPORT_USER_AGENT): boolean {
    let decision: Rule | null = null;
    for (const rule of rulesFor(robotsTxt, agent)) {
        if (!matches(rule.pattern, pathAndQuery)) continue;
        if (!decision || rule.pattern.length > decision.pattern.length || (rule.pattern.length === decision.pattern.length && rule.allow)) {
            decision = rule;
        }
    }
    return decision ? decision.allow : true;
}
