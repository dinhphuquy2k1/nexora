import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
const dir = new URL("../src/generated/", import.meta.url);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
const schema = JSON.parse(
  await readFile(
    new URL("../../../apps/api/openapi/openapi.json", import.meta.url),
    "utf8",
  ),
);
await writeFile(
  new URL("api.ts", dir),
  "// Generated. Do not edit.\n" + astToString(await openapiTS(schema)),
);
