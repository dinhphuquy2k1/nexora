import { glob } from "node:fs/promises";
import { stat } from "node:fs/promises";
const patterns = process.argv.slice(2);
try {
  if (!patterns.length) throw Error("Missing test discovery pattern");
  const files = new Set();
  for (const pattern of patterns) {
    let count = 0;
    for await (const file of glob(pattern)) {
      if (!(await stat(file)).isFile() || !/\.test\.(cjs|mjs)$/.test(file))
        throw Error(`Discovery pattern matched a non-suite path: ${file}`);
      if (files.has(file)) throw Error("Overlapping test discovery patterns");
      files.add(file);
      count++;
    }
    if (!count) throw Error(`No test suites matched: ${pattern}`);
  }
  console.log(`Test discovery: ${files.size} suites`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
