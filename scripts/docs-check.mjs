import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkDocumentation } from "./docs-check-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = await checkDocumentation(root);

if (failures.length > 0) {
  console.error("Documentation validation failures detected:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Documentation entry points, task governance, evidence, and relative links are valid.",
);
