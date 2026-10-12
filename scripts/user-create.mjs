// Host compatibility wrapper. The compiled API CLI is the authoritative implementation.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try {
  const { main } = require("../apps/api/dist/cli/user-create.js");
  await main();
} catch {
  console.error(
    "Account provisioning failed. Build the API and check configuration, username uniqueness and password policy.",
  );
  process.exitCode = 1;
}
