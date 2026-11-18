// Private whole-step observer. Only projected JSON is persisted; never raw tool output.
import { writeFileSync, renameSync } from "node:fs";
import {
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
} from "node:timers";
import {
  startPublicNetworkObserver,
  startPublicDockerObserver,
} from "./public-https-diagnostics.mjs";
const path = process.argv[2];
if (!path) throw Error("Environment observer path required");
const network = startPublicNetworkObserver({ maxEvents: 200 });
const docker = startPublicDockerObserver();
let stopping = false;
const persist = () => {
  const row = {
    capturedUTC: new Date().toISOString(),
    network: network.snapshot(),
    docker: docker.snapshot(),
  };
  writeFileSync(path + ".next", JSON.stringify(row), { mode: 0o600 });
  renameSync(path + ".next", path);
};
const finish = async () => {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  clearTimeout(deadline);
  await Promise.allSettled([network.stop(), docker.stop()]);
  try {
    persist();
  } catch {
    process.exitCode = 1;
  }
};
try {
  persist();
} catch {
  await Promise.allSettled([network.stop(), docker.stop()]);
  process.exit(1);
}
const interval = setInterval(() => {
  try {
    persist();
  } catch {
    void finish();
  }
}, 250);
const deadline = setTimeout(() => {
  void finish();
}, 2700000);
process.once("SIGTERM", finish);
process.once("SIGINT", finish);
process.once("SIGHUP", finish);
