#!/usr/bin/env node
// Read-only inventory of compiled build copies kept under .next-company-first/
// stores (the workspace store and the private worktrees' stores).
//
// Lists each compiled build copy with size in MiB and date, newest first,
// marks the newest KEEP_COUNT copies as KEEP, and prints the total disk space
// that removing the rest would free. This script NEVER deletes, moves or
// modifies anything; it only prints.

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export const STORE_DIR_NAME = ".next-company-first";
export const KEEP_COUNT = 3;
const MAX_SCAN_DEPTH = 8;
const SKIP_DIR_NAMES = new Set([".git", "node_modules"]);
// A compiled Next.js build copy contains the build output (server/, static/,
// cache/); plain `-inputs` snapshots and other entries are not compiled copies.
const BUILD_MARKERS = ["server", "static", "cache"];

export function isBuildCopy(dirPath, name) {
    if (name.endsWith("-inputs")) return false;
    let stat;
    try {
        stat = statSync(dirPath);
    } catch {
        return false;
    }
    if (!stat.isDirectory()) return false;
    return BUILD_MARKERS.some(marker => {
        try {
            return statSync(path.join(dirPath, marker)).isDirectory();
        } catch {
            return false;
        }
    });
}

export function directoryBytes(dirPath) {
    let total = 0;
    const walk = current => {
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                try {
                    total += statSync(full).size;
                } catch {
                    // unreadable entry: skip, still read-only
                }
            }
        }
    };
    walk(dirPath);
    return total;
}

// Every directory named .next-company-first under searchRoot (bounded depth,
// skipping VCS/dependency trees), including worktrees nested inside stores.
export function findStoreRoots(searchRoot) {
    const roots = [];
    const walk = (current, depth) => {
        if (depth > MAX_SCAN_DEPTH) return;
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (SKIP_DIR_NAMES.has(entry.name)) continue;
            const full = path.join(current, entry.name);
            if (entry.name === STORE_DIR_NAME) {
                roots.push(full);
                walk(full, depth + 1); // a worktree nested in a store can hold its own store
                continue;
            }
            // Compiled build copies hold no store; skip walking their payload.
            if (!entry.name.endsWith("-inputs") && isBuildCopy(full, entry.name)) continue;
            walk(full, depth + 1);
        }
    };
    walk(searchRoot, 0);
    return roots.sort();
}

// Inventory every compiled build copy across the given stores, newest first,
// with the newest `keepCount` entries marked keep. Pure: reads metadata only.
export function planBuildCopies(storeRoots, { keepCount = KEEP_COUNT } = {}) {
    const copies = [];
    for (const storeRoot of storeRoots) {
        let entries;
        try {
            entries = readdirSync(storeRoot, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const full = path.join(storeRoot, entry.name);
            if (!isBuildCopy(full, entry.name)) continue;
            let stat;
            try {
                stat = statSync(full);
            } catch {
                continue;
            }
            copies.push({
                name: entry.name,
                path: full,
                storeRoot,
                bytes: directoryBytes(full),
                mtimeMs: stat.mtimeMs,
            });
        }
    }
    copies.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
    copies.forEach((copy, index) => {
        copy.keep = index < keepCount;
    });
    return copies;
}

export function formatReport(copies, { keepCount = KEEP_COUNT } = {}) {
    const lines = [];
    const mib = bytes => (bytes / 1024 / 1024).toFixed(1);
    const date = mtimeMs => {
        const pad = n => String(n).padStart(2, "0");
        const d = new Date(mtimeMs);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    lines.push(`Compiled build copies found: ${copies.length} (newest ${keepCount} marked KEEP)`);
    lines.push("");
    lines.push(`  ${"MiB".padStart(9)}  DATE             MARK    COPY`);
    for (const copy of copies) {
        const rel = path.join(path.basename(copy.storeRoot), copy.name);
        lines.push(`  ${mib(copy.bytes).padStart(9)}  ${date(copy.mtimeMs)}  ${(copy.keep ? "KEEP" : "remove").padEnd(6)}  ${rel}`);
        lines.push(`  ${" ".repeat(9)}  ${" ".repeat(15)}        ${copy.path}`);
    }
    const freed = copies.filter(copy => !copy.keep).reduce((sum, copy) => sum + copy.bytes, 0);
    const kept = copies.filter(copy => copy.keep);
    lines.push("");
    if (copies.length <= keepCount) {
        lines.push(`All ${copies.length} copies are within the newest ${keepCount}; removing the rest would free 0 MiB.`);
    } else {
        lines.push(`Removing the ${copies.length - keepCount} copies not marked KEEP would free ${mib(freed)} MiB (${freed} bytes).`);
    }
    lines.push("Kept copies:");
    for (const copy of kept) lines.push(`  KEEP  ${copy.name}  (${mib(copy.bytes)} MiB)`);
    lines.push("");
    lines.push("Read-only report: nothing was deleted, moved or modified.");
    return lines.join("\n");
}

// First ancestor of startDir (inclusive) that holds the build-copy store or
// the private-worktrees directory; falls back to startDir.
export function defaultSearchRoot(startDir) {
    let current = path.resolve(startDir);
    for (;;) {
        for (const marker of [STORE_DIR_NAME, ".cq-wt"]) {
            try {
                if (statSync(path.join(current, marker)).isDirectory()) return current;
            } catch {
                // keep walking up
            }
        }
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(startDir);
        current = parent;
    }
}

function main(argv) {
    const args = argv.slice(2);
    let searchRoot = process.env.BUILD_COPIES_ROOT;
    const rootFlag = args.findIndex(arg => arg === "--root");
    if (rootFlag !== -1) {
        if (args.length <= rootFlag + 1) {
            console.error("usage: list-build-copies.mjs [--root <dir>]");
            process.exit(2);
        }
        searchRoot = args[rootFlag + 1];
    }
    searchRoot = path.resolve(searchRoot ?? defaultSearchRoot(process.cwd()));
    const storeRoots = findStoreRoots(searchRoot);
    const copies = planBuildCopies(storeRoots);
    console.log(`Search root: ${searchRoot}`);
    console.log(`Store roots (${storeRoots.length}):`);
    for (const root of storeRoots) console.log(`  ${root}`);
    console.log("");
    console.log(formatReport(copies));
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
    main(process.argv);
}
