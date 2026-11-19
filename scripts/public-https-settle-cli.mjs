import { readFile, writeFile } from "node:fs/promises";
import { waitForNetworkSettle } from "./public-https-settle.mjs";
const [environmentPath, outputPath] = process.argv.slice(2);
try {
  await waitForNetworkSettle({
    snapshot: async () => {
      try {
        const row = JSON.parse(await readFile(environmentPath, "utf8"));
        if (
          !Number.isFinite(Date.parse(row.capturedUTC)) ||
          Date.now() - Date.parse(row.capturedUTC) > 1500
        )
          return { network: { status: "UNAVAILABLE" } };
        return row;
      } catch {
        return { network: { status: "UNAVAILABLE" } };
      }
    },
    onResult: async (result) =>
      writeFile(outputPath, JSON.stringify(result), { mode: 0o600 }),
  });
} catch {
  process.exitCode = 1;
}
