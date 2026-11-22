// D78 requested post-approval signup journey, in an archived local CI source copy only.
// This file is never imported by the app and does not change the product policy.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const root = process.cwd();
const refuse = () => { throw new Error("D78_SIGNUP_FIXTURE_BOUNDARY_REFUSED"); };
if (process.env.E2E_D78_SIGNUP_FIXTURE !== "1" || process.env.CONSTRUCTA_DEPLOY_CONTEXT !== "e2e-replay") refuse();
if (existsSync(path.join(root, ".git")) || !existsSync(path.join(root, ".d78-disposable-source"))) refuse();
if (readFileSync(path.join(root, ".d78-disposable-source"), "utf8").trim() !== "D78 archived source; disposable CI only") refuse();
const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname) || api.port !== "54321") refuse();
const db = new URL(process.env.DB_URL ?? "");
if (!["postgres:", "postgresql:"].includes(db.protocol) || !["127.0.0.1", "localhost"].includes(db.hostname)) refuse();
if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) refuse();
const file = path.join(root, "src/lib/platform-signup-policy.ts");
const source = readFileSync(file, "utf8");
if (createHash("sha256").update(source).digest("hex") !== "5675fcccdd7d2eff1f3687c4537cbe907332f4c7b829432db8340ed9f77ac92e") refuse();
if (!source.includes("export function isPlatformSignupDisabled(): boolean {\n    return true;\n}")) refuse();
writeFileSync(file, source.replace("export function isPlatformSignupDisabled(): boolean {\n    return true;\n}", "// Disposable archived CI fixture only; not the released operator policy.\nexport function isPlatformSignupDisabled(): boolean {\n    return false;\n}"));
console.log("D78 fixture: signup enabled only in archived loopback CI source; product signup policy remains OFF.");
