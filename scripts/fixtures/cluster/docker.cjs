#!/usr/bin/env node
const fs = require("node:fs");
const path = process.env.FIXTURE_STATE,
  s = JSON.parse(fs.readFileSync(path)),
  a = process.argv.slice(2),
  mode = process.env.FIXTURE_MODE || "normal";
const id = (k) => ({ pg: "a", node: "b", net: "c" })[k].repeat(64);
const end = (code = 0, out = "", err = "") => {
  fs.writeFileSync(path, JSON.stringify(s));
  process.stdout.write(out);
  process.stderr.write(err);
  process.exit(code);
};
s.calls.push(a);
if (a[0] === "network" && a[1] === "create") {
  s.network = id("net");
  s.netLabel = a[a.indexOf("--label") + 1].split("=")[1];
  end(0, s.network);
}
if (a[0] === "network" && a[1] === "rm") {
  s.network = null;
  end(0, a.at(-1));
}
if (a[0] === "network" && a[1] === "inspect") {
  if (!s.network)
    end(
      1,
      "",
      "Error response from daemon: network " + a.at(-1) + " not found",
    );
  end(
    0,
    JSON.stringify([
      { Id: s.network, Labels: { "nexora.cluster-test": s.netLabel } },
    ]),
  );
}
if (a[0] === "create") {
  const pg = a.includes("postgres:17.11-bookworm"),
    cid = id(pg ? "pg" : "node"),
    name = a[a.indexOf("--name") + 1],
    label = a[a.indexOf("--label") + 1].split("=")[1];
  s.containers[cid] = {
    name,
    network: a[a.indexOf("--network") + 1],
    pg,
    running: false,
    labels: { "nexora.cluster-test": label },
  };
  if (
    (pg && mode === "partial-create") ||
    (!pg && mode === "partial-node-create")
  )
    end(1, "", "controlled create failure");
  if (mode === "unowned-create") {
    s.containers[cid].labels["nexora.cluster-test"] = "another-run";
    end(1, "", "controlled create failure");
  }
  end(0, cid);
}
if (a[0] === "start") {
  const cid = a.at(-1),
    c = s.containers[cid];
  c.running = true;
  if (!c.pg) {
    s.suites++;
    fs.writeFileSync(path, JSON.stringify(s));
    if (mode === "signal") setTimeout(() => end(), 5000);
    else if (["suite-fail", "both-fail", "redaction"].includes(mode))
      end(
        17,
        "AssertionError SELECT password FROM users",
        "code: '42501' postgresql://secret:password@host/db",
      );
    else end(0, "controlled SQL suite PASS\n");
  } else {
    if (mode === "startup-fail") c.running = false;
    end(0, cid);
  }
} else if (a[0] === "inspect") {
  const key = a.at(-1),
    c =
      s.containers[key] ||
      Object.values(s.containers).find((x) => x.name === key);
  if (mode === "inspect-fail" && s.removed)
    end(1, "", "permission denied by daemon");
  if (mode === "malformed" && s.removed) end(0, "not json");
  if (!c) end(1, "", "Error response from daemon: No such object: " + key);
  if (mode === "ownership-fail" && c.running)
    end(0, JSON.stringify([{ Id: "wrong" }]));
  end(
    0,
    JSON.stringify([
      {
        Id: id(c.pg ? "pg" : "node"),
        Name: "/" + c.name,
        State: {
          Running: c.running,
          ExitCode:
            !c.pg &&
            ["suite-fail", "both-fail", "suite-status-fail"].includes(mode)
              ? 17
              : 0,
        },
        Config: { Image: "postgres:17.11-bookworm", Labels: c.labels },
        NetworkSettings: { Networks: { [c.network]: {} } },
      },
    ]),
  );
} else if (a[0] === "exec") {
  const tcp = a.some((x) => x.includes(" -h ")) || a.includes("-h");
  if (tcp) s.tcp++;
  else s.socket++;
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    if (mode === "tcp-timeout" && tcp) end(1);
    if (mode === "temporary" && tcp && s.tcp < 3) end(1);
    if (input.includes("COMMENT")) s.stamped = true;
    end(0, "1\n");
  });
} else if (a[0] === "rm") {
  s.removed = true;
  if (["rm-fail", "both-fail"].includes(mode))
    end(1, "", "controlled removal failure");
  delete s.containers[a.at(-1)];
  end(0, a.at(-1));
} else if (a[0] === "image" && a[1] === "inspect") {
  if (mode === "negative-image" || mode === "build-fail")
    end(1, "", "Error response from daemon: No such image: " + a.at(-1));
  end(0, "[]");
} else if (a[0] === "build") {
  if (mode === "build-fail") end(1, "", "controlled build failure");
  end(0, "Successfully built nexora-dev:0.1.0\n");
} else if (a[0] !== "start") end(2, "", "unexpected fixture command");
