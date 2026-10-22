#!/usr/bin/env node
const fs = require("node:fs"),
  path = process.env.FIXTURE_STATE,
  s = JSON.parse(fs.readFileSync(path)),
  a = process.argv.slice(2),
  mode = process.env.FIXTURE_MODE;
const end = (code = 0, out = "", err = "") => {
  fs.writeFileSync(path, JSON.stringify(s));
  process.stdout.write(out);
  process.stderr.write(err);
  process.exit(code);
};
s.calls.push(a);
if (a[0] === "create") {
  s.container = {
    Id: "a".repeat(64),
    Name: "/" + a[a.indexOf("--name") + 1],
    Config: {
      Labels: {
        "nexora.cleanup-test": a[a.indexOf("--label") + 1].split("=")[1],
      },
    },
  };
  fs.writeFileSync(path, JSON.stringify(s));
  if (mode === "partial") end(1);
  else if (mode === "create-timeout")
    setTimeout(() => end(0, s.container.Id), 5000);
  else end(0, s.container.Id);
} else if (a[0] === "inspect") {
  if (mode === "inspect-fail") end(1, "", "permission denied");
  if (!s.container) {
    if (mode === "absence-unverified") end(1, "", "daemon unavailable");
    else end(1, "", "Error: No such object: " + a.at(-1));
  }
  if (mode === "id-mismatch")
    end(
      0,
      JSON.stringify([
        {
          ...s.container,
          Id: "b".repeat(64),
        },
      ]),
    );
  if (mode === "malformed-inspect") end(0, "not json");
  if (mode === "empty-inspect") end(0, "[]");
  end(0, JSON.stringify([s.container]));
} else if (a[0] === "rm") {
  if (mode === "rm-fail") end(1, "", "controlled rm failed");
  s.container = null;
  end();
} else if (a[0] === "start" || a[0] === "cp") end();
else if (a.includes("pg_isready")) {
  if (mode === "signal") {
    s.waiting = true;
    fs.writeFileSync(path, JSON.stringify(s));
    setTimeout(() => end(), 5000);
  } else end();
} else if (a[0] === "exec") {
  if (a.includes("/tmp/cleanup.sql")) {
    const value = (k) =>
      a.find((v) => v.startsWith(k + "="))?.slice(k.length + 1);
    if (
      value("deployment_env") !== "development" ||
      value("expected_database") === "wrong" ||
      value("username_prefix") === "" ||
      (value("dry_run") === "false" &&
        value("confirmation") !== "DELETE_TEST_OPERATORS")
    )
      end(1);
    if (value("dry_run") === "false") s.count = 3;
    end();
  } else {
    let input = "";
    process.stdin.on("data", (c) => (input += c));
    process.stdin.on("end", () => {
      if (mode === "sql-fail")
        end(17, "", "sensitive SQL/password should not leak");
      if (input.includes("SELECT count(*) FROM users WHERE username"))
        end(0, "0");
      if (
        input.includes("WHERE role='ADMIN'") ||
        input.includes("SELECT count(*) FROM user_credentials")
      )
        end(0, "1");
      if (input.includes("SELECT count(*) FROM users")) end(0, String(s.count));
      end();
    });
  }
} else end(2, "", "unexpected fixture command");
