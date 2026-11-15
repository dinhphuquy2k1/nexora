const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { resolve, join, relative, extname } = require("node:path");
const { createHash } = require("node:crypto");
const root =
  process.env.UNISHIP_FIXTURE_DIRECTORY ??
  resolve(__dirname, "fixtures/uniship");
const capturedHashes = {
  "transition-page.json":
    "b328f42ea39a2870623a7a1c28bc29b98ca6ae90f4690d9f06ba1cd6f4473a2c",
  "china-stores.json":
    "8fd8c076a0598b8c195eefcea8747cc463b10ec5fce0731043b1350ee59cccdf",
};
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    assert.ok(entry.isFile(), "fixture entries must be ordinary files");
    return [path];
  });
}
test("Uniship fixture directory contains no credential markers or private contact fields", () => {
  const patterns = [
    ["token marker", /eyJ/],
    ["authorization marker", /Bearer/i],
    ["analytics marker", /_ga/i],
    ["original account marker", /wayki201|7431/],
    ["phone-shaped digits", /0\d{9}/],
    [
      "private contact key",
      /"(?:Phone|Address|Receiver|FirstName|LastName|Email)"\s*:/i,
    ],
  ];
  const paths = files(root);
  assert.ok(
    paths.length >= 4,
    "expected captured/derived responses and provenance",
  );
  for (const path of paths) {
    const name = relative(root, path);
    const checkText = (text) => {
      for (const [reason, pattern] of patterns)
        assert.equal(pattern.test(text), false, `${name}: ${reason}`);
    };
    const text = readFileSync(path, "utf8");
    checkText(text);
    if (extname(path) === ".json") {
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        assert.fail(`${name}: invalid fixture JSON`);
      }
      const inspect = (entry) => {
        if (typeof entry === "string") checkText(entry);
        else if (entry && typeof entry === "object")
          for (const [key, child] of Object.entries(entry)) {
            assert.equal(
              /^(Phone|Address|Receiver|FirstName|LastName|Email)$/i.test(key),
              false,
              `${name}: private contact key`,
            );
            checkText(key);
            inspect(child);
          }
      };
      inspect(value);
    }
  }
});
test("captured Uniship responses retain owner-supplied bytes and JSON envelopes", () => {
  for (const [name, expected] of Object.entries(capturedHashes)) {
    const bytes = readFileSync(join(root, name));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected,
      name,
    );
    const envelope = JSON.parse(bytes.toString("utf8"));
    assert.equal(envelope.status, 200);
    assert.ok(Array.isArray(envelope.data));
  }
  const transition = JSON.parse(
    readFileSync(join(root, "transition-page.json"), "utf8"),
  );
  assert.equal(transition.rowsPerPage, 15);
  const stores = JSON.parse(
    readFileSync(join(root, "china-stores.json"), "utf8"),
  );
  assert.equal(stores.total, 24);
  for (const store of stores.data)
    assert.deepEqual(Object.keys(store), [
      "ID",
      "Name",
      "StoreType",
      "CountryCode",
      "IsHidden",
    ]);
});
test("synthetic status cases preserve all non-overridden captured fields and types", () => {
  const source = JSON.parse(
    readFileSync(join(root, "transition-page.json"), "utf8"),
  ).data[0];
  const derived = JSON.parse(
    readFileSync(join(root, "transition-statuses.json"), "utf8"),
  );
  assert.deepEqual(
    derived.data.map((row) => row.Status),
    [1, 2, 3, 4, 5, 13, 0, 99],
  );
  assert.equal(derived.total, 8);
  for (const row of derived.data) {
    assert.deepEqual(Object.keys(row), Object.keys(source));
    for (const key of Object.keys(source))
      if (!["ID", "TransactionCode", "Status", "OldStatus"].includes(key))
        assert.deepEqual(row[key], source[key], key);
    assert.equal(row.UID, 1000);
    assert.equal(row.Username, "redacted-user");
    assert.equal(row.CreatedBy, "redacted-user");
    assert.equal(row.OldStatus, row.Status === 13 ? 4 : null);
  }
});
