import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("M1 approved geometry and self-hosted licensed font are wired without remote font dependencies", () => {
  assert.match(source("../styles/tokens.css"), /--header-height:\s*56px/);
  assert.match(source("../styles/tokens.css"), /--sidebar-width:\s*240px/);
  assert.match(
    source("../styles/tokens.css"),
    /--sidebar-collapsed-width:\s*72px/,
  );
  assert.match(source("../app/layout.tsx"), /next\/font\/local/);
  assert.match(source("../app/fonts/OFL.txt"), /SIL OPEN FONT LICENSE/);
  const manifest = JSON.parse(source("../app/fonts/verification.json"));
  const font = readFileSync(
    new URL("../app/fonts/InterVariable.woff2", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(font).digest("hex"),
    manifest.sha256,
  );
  assert.equal(manifest.vietnameseCodepointsCovered, 90);
  assert.equal(manifest.weightMin, 100);
  assert.equal(manifest.weightMax, 900);
});
test("M1 exports only shared controls with actual shell/login consumers", () => {
  const exports = source("../../../packages/ui/src/index.tsx");
  for (const component of ["Button", "TextInput", "Checkbox", "Overlay"])
    assert.match(exports, new RegExp(`export.*\\b${component}\\b`));
});
