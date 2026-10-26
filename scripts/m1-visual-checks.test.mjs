import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { M1_VIEWPORTS, verifyM1Visuals } from "./m1-visual-checks.mjs";
test("M1 viewport inventory matches all ten v3 approved sizes", () =>
  assert.deepEqual(
    M1_VIEWPORTS.map((v) => `${v.width}x${v.height}`),
    [
      "1920x1080",
      "1440x900",
      "1280x800",
      "1100x800",
      "1024x768",
      "901x768",
      "900x768",
      "768x1024",
      "390x844",
      "375x812",
    ],
  ));
test("M1 capture refuses nonempty password/proof fields and restores emulation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-m1-privacy-"));
  const commands = [];
  try {
    await assert.rejects(
      verifyM1Visuals({
        directory,
        phase: "mfa",
        prefix: "admin",
        send: async (method) => {
          commands.push(method);
          if (method === "Page.captureScreenshot")
            throw Error("Must never capture");
          return {};
        },
        evaluate: async (expression) => {
          new Function(expression);
          return true;
        },
      }),
      { name: "AssertionError" },
    );
    assert.ok(!commands.includes("Page.captureScreenshot"));
    assert.equal(commands.at(-1), "Emulation.clearDeviceMetricsOverride");
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("M1 evidence switch leaves non-M1 smoke callers unchanged", async () => {
  await verifyM1Visuals({
    directory: "",
    phase: "login",
    prefix: "operator",
    send: () => {
      throw Error("not enabled");
    },
    evaluate: () => {
      throw Error("not enabled");
    },
  });
});
