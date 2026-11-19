import { readFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function selectPublicHttpsExperiment(eventName, event = {}) {
  let enabled = false;
  let mode = "step8-only";
  if (eventName === "workflow_dispatch") {
    mode = event.inputs?.mode ?? mode;
    if (!["step8-only", "runtime-then-https", "foundation"].includes(mode))
      throw Error("Unsupported HTTPS experiment mode");
    enabled = true;
  } else if (eventName === "pull_request") {
    const labels = event.pull_request?.labels ?? [];
    enabled = labels.some((label) => label.name === "https-stress");
    if (labels.some((label) => label.name === "https-stress-runtime"))
      mode = "runtime-then-https";
    if (labels.some((label) => label.name === "https-stress-full")) {
      enabled = true;
      mode = "foundation";
    }
  }
  // Disabled plans keep a valid matrix shape; the job-level gate skips all trials.
  let count = 1;
  if (enabled) count = mode === "runtime-then-https" ? 10 : 15;
  return {
    enabled,
    mode,
    matrix: { trial: Array.from({ length: count }, (_, i) => i + 1) },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    const plan = selectPublicHttpsExperiment(
      process.env.GITHUB_EVENT_NAME,
      event,
    );
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `enabled=${plan.enabled}\nmode=${plan.mode}\nmatrix=${JSON.stringify(plan.matrix)}\n`,
    );
  } catch {
    console.error("HTTPS experiment selection failed");
    process.exitCode = 1;
  }
}
