import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try {
  const { main } = require("../apps/api/dist/cli/mfa-enroll.js");
  await main();
} catch {
  console.error(
    "MFA enrollment failed. Build API and check Identity key custody, ADMIN credentials and TOTP confirmation in a trusted interactive terminal.",
  );
  process.exitCode = 1;
}
