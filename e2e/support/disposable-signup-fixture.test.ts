import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = path.resolve(import.meta.dirname, "../..");
const script = path.join(root, "scripts/ephemeral-replay/enable-disposable-signup-fixture.mjs");
const policy = readFileSync(path.join(root, "src/lib/platform-signup-policy.ts"), "utf8");
function fixture(overrides: Record<string, string> = {}, alter?: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "d78-signup-fixture-"));
  mkdirSync(path.join(dir, "src/lib"), { recursive: true });
  const file = path.join(dir, "src/lib/platform-signup-policy.ts");
  writeFileSync(file, policy);
  writeFileSync(path.join(dir, ".d78-disposable-source"), "D78 archived source; disposable CI only");
  alter?.(dir);
  const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8", env: {
    PATH: process.env.PATH, E2E_D78_SIGNUP_FIXTURE: "1", CONSTRUCTA_DEPLOY_CONTEXT: "e2e-replay",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", DB_URL: "postgresql://localhost:54322/disposable", ...overrides,
  } });
  const after = readFileSync(file, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, after };
}
describe("D78 signup fixture is confined to an archived loopback CI source", () => {
  it("changes only the disposable copy and leaves committed signup OFF", () => {
    const result = fixture();
    expect(result.status).toBe(0);
    expect(result.after).toContain("return false;");
    expect(readFileSync(path.join(root, "src/lib/platform-signup-policy.ts"), "utf8")).toBe(policy);
    expect(policy).toContain("return true;");
  });
  it.each([
    { E2E_D78_SIGNUP_FIXTURE: "0" }, { CONSTRUCTA_DEPLOY_CONTEXT: "preview" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.com" }, { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:59999" },
    { DB_URL: "postgresql://example.com/disposable" }, { VERCEL: "1" }, { VERCEL_ENV: "preview" },
  ])("refuses boundary mismatch without touching policy: %o", (env) => {
    const result = fixture(env); expect(result.status).not.toBe(0); expect(result.after).toBe(policy);
  });
  it("refuses a real checkout even if a marker was copied there", () => {
    const result = fixture({}, (dir) => writeFileSync(path.join(dir, ".git"), "gitdir: elsewhere"));
    expect(result.status).not.toBe(0); expect(result.after).toBe(policy);
  });
  it("refuses changed or unmarked source", () => {
    for (const change of [
      (dir: string) => writeFileSync(path.join(dir, ".d78-disposable-source"), "not the archive"),
      (dir: string) => writeFileSync(path.join(dir, "src/lib/platform-signup-policy.ts"), policy + "\n// changed"),
    ]) expect(fixture({}, change).status).not.toBe(0);
  });
});
