import test from "node:test";
import assert from "node:assert/strict";
import { assertWorkspaceGeometry } from "./workspace-geometry-checks.mjs";
test("geometry fails either mismatched edge, wrong gutter, overflow and wrong max-width", () => {
  const good = {
    variant: "standard",
    gutter: 24,
    headerLeft: 184,
    mainLeft: 184,
    headerRight: 1736,
    mainRight: 1736,
    headerHeight: 56,
    frameWidth: 1600,
    wrapperWidth: 1680,
    noBodyOverflow: true,
    mainOutlineStyle: "none",
    mainOutlineWidth: 0,
    mainBorderTop: 0,
    mainBorderLeft: 0,
  };
  assert.doesNotThrow(() => assertWorkspaceGeometry(good, 1920));
  for (const change of [
    { headerLeft: 185.1 },
    { headerRight: 1738 },
    { gutter: 32 },
    { headerHeight: 60 },
    { frameWidth: 1602 },
    { noBodyOverflow: false },
    { variant: "wide" },
    { mainOutlineStyle: "solid", mainOutlineWidth: 2 },
    { mainBorderTop: 1 },
    { mainBorderLeft: 1 },
  ])
    assert.throws(() => assertWorkspaceGeometry({ ...good, ...change }, 1920));
  assert.doesNotThrow(() =>
    assertWorkspaceGeometry(
      { ...good, variant: "wide", frameWidth: 1680 },
      1920,
    ),
  );
  for (const [width, gutter] of [
    [901, 24],
    [900, 16],
    [600, 12],
    [375, 12],
  ])
    assert.doesNotThrow(() =>
      assertWorkspaceGeometry({ ...good, gutter }, width),
    );
});
