import { URLSearchParams } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseScope,
  writeScope,
  resolveScope,
  filterGroups,
  groupMetadata,
} from "../features/shipping-scope/model.ts";
const carriers = [{ provider: "uniship", displayName: "Uniship" }];
const connections = [
  {
    id: "a",
    provider: "uniship",
    displayName: "Tên trùng rất dài",
    status: "CONNECTED",
  },
  {
    id: "b",
    provider: "uniship",
    displayName: "Tên trùng rất dài",
    status: "REAUTH_REQUIRED",
  },
];
const metadata = groupMetadata(carriers, connections);
test("scope round trips and preserves unrelated query, resets page", () => {
  for (const scope of [
    { type: "all" },
    { type: "provider", provider: "uniship" },
    { type: "connection", provider: "uniship", id: "a" },
  ]) {
    const query = writeScope(
      new URLSearchParams("q=áo&custom=1&page=8"),
      scope,
    );
    assert.deepEqual(parseScope(query), scope);
    assert.equal(query.get("q"), "áo");
    assert.equal(query.get("custom"), "1");
    assert.equal(query.has("page"), false);
  }
});
test("malformed or duplicate parameters never broaden", () => {
  for (const q of [
    "provider=",
    "connection=a",
    "provider=x&provider=y",
    "provider=x&connection=",
    "provider=uniship&connection=a&connection=b",
  ])
    assert.equal(parseScope(new URLSearchParams(q)).type, "invalid", q);
});
test("unknown, deleted or cross-provider selection is invalid", () => {
  for (const scope of [
    { type: "provider", provider: "missing" },
    { type: "connection", provider: "uniship", id: "deleted" },
    { type: "connection", provider: "other", id: "a" },
  ])
    assert.equal(resolveScope(scope, metadata).valid, false);
  assert.equal(
    resolveScope({ type: "connection", provider: "uniship", id: "b" }, metadata)
      .valid,
    true,
  );
  assert.equal(
    resolveScope({ type: "connection", provider: "uniship", id: "b" }, [])
      .valid,
    false,
  );
});
test("group once, preserve duplicate labels and problematic statuses, search provider or account", () => {
  assert.equal(metadata[0].connections.length, 2);
  assert.equal(metadata[0].connections[1].status, "REAUTH_REQUIRED");
  assert.equal(filterGroups(metadata, "TRÙNG")[0].connections.length, 2);
  assert.equal(filterGroups(metadata, "uniship")[0].connections.length, 2);
  assert.equal(filterGroups(metadata, "unknown").length, 0);
});

test("metadata keeps only allowlisted fields and rejects malformed/ambiguous response", () => {
  const result = groupMetadata(
    [{ ...carriers[0], token: "excluded" }],
    [{ ...connections[0], password: "excluded" }],
  );
  assert.deepEqual(Object.keys(result[0]).sort(), [
    "connections",
    "displayName",
    "provider",
  ]);
  assert.deepEqual(Object.keys(result[0].connections[0]).sort(), [
    "displayName",
    "id",
    "provider",
    "status",
  ]);
  for (const malformed of [
    [{ ...connections[0], displayName: null }],
    [{ ...connections[0], status: "invented" }],
    [connections[0], connections[0]],
  ])
    assert.throws(() => groupMetadata(carriers, malformed));
});
