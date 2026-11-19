// Read-only test diagnostic. Failure must never alter the smoke assertion outcome.
import { writeFileSync } from "node:fs";
import { capturePublicPreexistingContainers } from "./public-https-diagnostics.mjs";
try {
  writeFileSync(
    process.argv[2],
    JSON.stringify(capturePublicPreexistingContainers()),
    { mode: 0o600 },
  );
} catch {
  console.error(
    'PUBLIC_PREEXISTING_CONTAINERS_DIAGNOSTIC {"status":"UNAVAILABLE"}',
  );
}
