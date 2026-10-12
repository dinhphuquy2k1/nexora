import { readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const checksum = async (p) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream("/backup/" + p))
    hash.update(chunk);
  return hash.digest("hex");
};
const files = ["database.dump", "uploads.tar.gz"];
if (process.argv[2] === "create") {
  await writeFile(
    "/backup/manifest.json",
    JSON.stringify(
      {
        format: 1,
        foundation: "0.1.0",
        createdAt: new Date().toISOString(),
        files: Object.fromEntries(
          await Promise.all(files.map(async (p) => [p, await checksum(p)])),
        ),
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
} else {
  const m = JSON.parse(await readFile("/backup/manifest.json", "utf8"));
  if (m.format !== 1 || m.foundation !== "0.1.0")
    throw Error("Unsupported backup version");
  for (const p of files)
    if (m.files[p] !== (await checksum(p)))
      throw Error("Checksum mismatch: " + p);
  const entries = execFileSync("tar", ["-tzf", "/backup/uploads.tar.gz"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  for (const e of entries)
    if (
      e !== "./" &&
      !/^\.\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        e,
      )
    )
      throw Error("Unsafe archive path");
  const modes = execFileSync("tar", ["-tvzf", "/backup/uploads.tar.gz"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  if (modes.some((l) => !["-", "d"].includes(l[0])))
    throw Error("Archive links prohibited");
  console.log("Backup version, checksums and archive safety PASS");
}
