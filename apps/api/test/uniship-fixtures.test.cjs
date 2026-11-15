const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
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
// Explicit property names avoid treating metadata such as tokenCount or
// passwordPolicy as secrets. No captured credential-property exception exists.
const credentialKeys = new Set([
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authtoken",
  "authenticationtoken",
  "bearertoken",
  "jwttoken",
  "jwt",
  "oauthtoken",
  "password",
  "passwd",
  "passphrase",
  "secret",
  "clientsecret",
  "apikey",
  "apisecret",
  "secretkey",
  "accesskey",
  "accesskeyid",
  "privatekey",
  "authorization",
  "authheadervalue",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "session",
  "sessionid",
  "sessiontoken",
  "sessionkey",
  "sessioncookie",
  "sessionsecret",
  "csrftoken",
  "xsrftoken",
  "credential",
  "credentials",
  "clientassertion",
]);
const contactKeys = new Set([
  "phone",
  "address",
  "receiver",
  "firstname",
  "lastname",
  "email",
]);
const nullOnlyPersonalKeys = new Set([
  "fakecustomername",
  "fakecustomeraddress",
  "fakecustomerphone",
]);
const canonicalKey = (key) => key.toLowerCase().replace(/[-_\s]/g, "");
function scanFixtureDirectory(directory) {
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
  const paths = files(directory);
  for (const path of paths) {
    const name = relative(directory, path);
    const checkText = (text) => {
      for (const [reason, pattern] of patterns)
        if (pattern.test(text)) assert.fail(`${name}: ${reason}`);
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
            const field = canonicalKey(key);
            if (credentialKeys.has(field))
              assert.fail(`${name}: credential key (${field})`);
            if (contactKeys.has(field))
              assert.fail(`${name}: private contact key (${field})`);
            if (nullOnlyPersonalKeys.has(field) && child !== null)
              assert.fail(`${name}: populated personal field (${field})`);
            checkText(key);
            inspect(child);
          }
      };
      inspect(value);
    }
  }
}
test("Uniship fixture directory contains no credential markers or private contact fields", () => {
  assert.ok(
    files(root).length >= 4,
    "expected captured/derived responses and provenance",
  );
  scanFixtureDirectory(root);
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

function temporaryFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "nexora-uniship-scan-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "nested", "case.json");
  mkdirSync(join(directory, "nested"));
  return { directory, path };
}
function rejectPayload(fixture, payload) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  writeFileSync(fixture.path, raw);
  let failure;
  try {
    scanFixtureDirectory(fixture.directory);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, "scanner accepted a forbidden synthetic fixture");
  assert.equal(
    failure.message.startsWith(join("nested", "case.json") + ":"),
    true,
    "diagnostic must identify only the relative fixture",
  );
  assert.equal(
    failure.message.includes("\n"),
    false,
    "diagnostic must be one safe line",
  );
  const strings = [];
  function collect(value) {
    if (typeof value === "string" && value.length) strings.push(value);
    else if (value && typeof value === "object")
      for (const child of Object.values(value)) collect(child);
  }
  collect(typeof payload === "string" ? JSON.parse(payload) : payload);
  assert.equal(
    strings.some((value) => failure.message.includes(value)),
    false,
    "diagnostic must not disclose an injected value",
  );
}
const requiredCases = [
  ["A access token", { access_token: "synthetic-secret" }],
  [
    "B cookie and authorization",
    { Cookie: "synthetic-session", Authorization: "synthetic-credential" },
  ],
  [
    "C nested refresh token",
    { data: { auth: { refreshToken: "synthetic-refresh-value" } } },
  ],
  [
    "D populated personal fields",
    {
      FakeCustomerName: "Synthetic Person",
      FakeCustomerAddress: "Synthetic Address",
      FakeCustomerPhone: "0123456789",
    },
  ],
  ["D isolated personal name", { FakeCustomerName: "Synthetic Person" }],
  ["D isolated personal address", { FakeCustomerAddress: "Synthetic Address" }],
  [
    "D isolated personal phone without digit marker",
    { FakeCustomerPhone: "synthetic-contact" },
  ],
];
for (const [name, payload] of requiredCases)
  test("scanner rejects review case " + name, (t) =>
    rejectPayload(temporaryFixture(t), payload),
  );

test("scanner accepts review case E with only approved null personal fields", (t) => {
  const fixture = temporaryFixture(t);
  writeFileSync(
    fixture.path,
    JSON.stringify({
      FakeCustomerName: null,
      FakeCustomerAddress: null,
      FakeCustomerPhone: null,
    }),
  );
  scanFixtureDirectory(fixture.directory);
});
test("credential key variants are forbidden with populated, null and empty values", (t) => {
  const fixture = temporaryFixture(t);
  for (const key of [
    "access_token",
    "refresh_token",
    "accessToken",
    "refreshToken",
    "password",
    "Password",
    "client_secret",
    "api_key",
    "apiKey",
    "Cookie",
    "Set-Cookie",
    "Authorization",
    "ID_TOKEN",
    "authToken",
    "session",
    "sessionId",
    "session_token",
    "sessionKey",
    "secret",
    "credentials",
    "csrfToken",
    "privateKey",
    "access_key_id",
    "Proxy-Authorization",
    "Access Token",
    "pAss\nWord",
  ])
    for (const value of [null, "", "synthetic-value"])
      rejectPayload(fixture, { data: [{ [key]: value }] });
});
test("preserved personal fields permit null only across key spelling variants", (t) => {
  const fixture = temporaryFixture(t);
  for (const key of [
    "FakeCustomerName",
    "fake_customer_address",
    "FAKE-CUSTOMER-PHONE",
  ])
    for (const value of ["", "synthetic-personal", 0, false, [], {}])
      rejectPayload(fixture, { data: [{ [key]: value }] });
});
test("decoded JSON credential keys are inspected inside nested arrays", (t) => {
  rejectPayload(
    temporaryFixture(t),
    '{"data":[{"auth":{"refresh\\u0054oken":"synthetic-escaped"}}]}',
  );
});
test("legacy raw markers and exact contact-key checks remain effective", (t) => {
  const fixture = temporaryFixture(t);
  for (const value of [
    "Bearer synthetic",
    "eyJ-synthetic",
    "_ga=synthetic",
    "wayki201",
    "7431",
    "0123456789",
  ])
    rejectPayload(fixture, { data: [{ note: value }] });
  for (const key of [
    "Phone",
    "Address",
    "Receiver",
    "FirstName",
    "LastName",
    "Email",
  ])
    rejectPayload(fixture, { data: [{ [key]: null }] });
  rejectPayload(fixture, '{"note":"\\u0065yJ-synthetic"}');
});
test("explanatory README text and ordinary non-credential JSON keys remain allowed", (t) => {
  const fixture = temporaryFixture(t);
  writeFileSync(
    join(fixture.directory, "README.md"),
    "Describe access_token, refreshToken, password, Cookie, Set-Cookie and Authorization property names without actual credential values.",
  );
  writeFileSync(
    fixture.path,
    JSON.stringify({
      auth: { version: 1 },
      tokenCount: 3,
      nextPageToken: "page-two",
      passwordPolicy: "documented",
      authorizationStatus: "disabled",
      sessionStatus: "idle",
      CountryCode: "C",
      IsHidden: null,
    }),
  );
  scanFixtureDirectory(fixture.directory);
});

test("scanner rejects the explicit auth-header-value credential alias", (t) => {
  const fixture = temporaryFixture(t);
  for (const key of [
    "auth_header_value",
    "authHeaderValue",
    "AUTH-HEADER-VALUE",
    "Auth Header Value",
  ])
    for (const value of ["synthetic-sensitive-value", null, ""])
      rejectPayload(fixture, { data: [{ auth: { [key]: value } }] });
  rejectPayload(
    fixture,
    '{"data":[{"auth\\u005fheader_value":"synthetic-encoded-value"}]}',
  );
});
