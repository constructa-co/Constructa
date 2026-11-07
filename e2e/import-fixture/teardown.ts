import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Takes the harness back out of the app, and removes the build that
 * contained it so it can never be started or deployed by mistake.
 */
export default function teardown() {
    rmSync(path.resolve("src/app/admin-e2e-import-fixture"), { recursive: true, force: true });
    rmSync(path.resolve(".next"), { recursive: true, force: true });
}
