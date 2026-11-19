import { setTimeout as delay } from "node:timers/promises";
const groups = ["lo", "eth", "docker0", "bridge", "veth", "other"];
const categories = ["ADDR", "ROUTE"];
const utc = (time) => new Date(time).toISOString();
const count = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
export async function waitForNetworkSettle({
  snapshot,
  now = Date.now,
  sleep = delay,
  log = console.error,
  onResult = async () => {},
}) {
  const started = now();
  let quietSince = started,
    previous,
    baseline,
    latest,
    unavailable = false;
  const events = Object.fromEntries(
    groups.map((g) => [g, { ADDR: 0, ROUTE: 0 }]),
  );
  const timeout = async () => {
    const result = {
      status: "TIMEOUT",
      ingressStartUTC:
        (latest?.docker?.events ?? [])
          .filter(
            (e) =>
              e.Type === "container" &&
              e.service === "ingress" &&
              e.Action === "start",
          )
          .at(-1)?.atUTC ?? null,
      startedUTC: utc(started),
      endedUTC: utc(now()),
      waitedMs: now() - started,
      events,
    };
    await onResult(result);
    const line =
      "PUBLIC_HTTPS_NETWORK_SETTLE_TIMEOUT " + JSON.stringify(result);
    log(line);
    throw Error(line);
  };
  while (true) {
    latest = await snapshot();
    const network = latest?.network;
    if (
      !network ||
      network.status === "UNAVAILABLE" ||
      network.status === "STOPPED"
    ) {
      unavailable = true;
      const remaining = 30000 - (now() - started);
      if (remaining < 5000) {
        await sleep(Math.max(0, remaining));
        await timeout();
      }
      await sleep(5000);
      break;
    }
    if (!baseline) baseline = network.groupCounts ?? {};
    const current = groups.flatMap((g) =>
      categories.map((c) => count(network.groupCounts?.[g]?.[c])),
    );
    if (previous && current.some((n, i) => n !== previous[i]))
      quietSince = now();
    if (network.status !== "OBSERVING") quietSince = now();
    previous = current;
    for (const g of groups)
      for (const c of categories)
        events[g][c] = Math.max(
          0,
          count(network.groupCounts?.[g]?.[c]) - count(baseline[g]?.[c]),
        );
    if (now() - started > 30000) await timeout();
    if (network.status === "OBSERVING" && now() - quietSince >= 5000) break;
    if (now() - started >= 30000) await timeout();
    await sleep(Math.min(100, 30000 - (now() - started)));
  }
  const ingress = (latest?.docker?.events ?? [])
    .filter(
      (e) =>
        e.Type === "container" &&
        e.service === "ingress" &&
        e.Action === "start",
    )
    .at(-1);
  const result = {
    status: unavailable ? "UNAVAILABLE" : "SETTLED",
    fallbackFixedWaitMs: unavailable ? 5000 : 0,
    observerReason: unavailable
      ? new Set([
          "UNSUPPORTED_PLATFORM",
          "SPAWN_FAILED",
          "EXITED",
          "STOP_FAILED",
        ]).has(latest?.network?.reason)
        ? latest.network.reason
        : "SNAPSHOT_UNAVAILABLE"
      : null,
    ingressStartUTC: ingress?.atUTC ?? null,
    startedUTC: utc(started),
    endedUTC: utc(now()),
    waitedMs: now() - started,
    events,
  };
  await onResult(result);
  log("PUBLIC_HTTPS_NETWORK_SETTLE " + JSON.stringify(result));
  return result;
}
const resourceTypes = new Set([
  "Document",
  "Stylesheet",
  "Image",
  "Media",
  "Font",
  "Script",
  "TextTrack",
  "XHR",
  "Fetch",
  "Prefetch",
  "EventSource",
  "WebSocket",
  "Manifest",
  "SignedExchange",
  "Ping",
  "CSPViolationReport",
  "Preflight",
  "Other",
]);
const errors = new Set([
  "net::ERR_NETWORK_CHANGED",
  "net::ERR_INTERNET_DISCONNECTED",
  "net::ERR_ABORTED",
  "net::ERR_FAILED",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_CLOSED",
  "net::ERR_TIMED_OUT",
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_CONNECTION_REFUSED",
]);
/** CDP inputs are private; retain only fixed resource vocabulary and timestamps. */
export function createBrowserStartWindow({ launchedAt, now = Date.now }) {
  const requests = [],
    events = [],
    pending = new Map();
  let requestsDropped = 0,
    eventsDropped = 0,
    captureEnabledUTC = null;
  const inside = () => now() >= launchedAt && now() <= launchedAt + 10000;
  return {
    enabled() {
      captureEnabledUTC = utc(now());
    },
    network(e) {
      if (!inside() || !categories.includes(e.category)) return;
      if (events.length === 64) {
        eventsDropped++;
        return;
      }
      events.push({
        category: e.category,
        interfaceGroup: groups.includes(e.interfaceGroup)
          ? e.interfaceGroup
          : "other",
        atUTC: utc(now()),
      });
    },
    observe({ method, params = {} }) {
      if (!inside()) return;
      if (method === "Network.requestWillBeSent") {
        if (requests.length === 200) {
          requestsDropped++;
          return;
        }
        const row = {
          resourceType: resourceTypes.has(params.type) ? params.type : "Other",
          startedUTC: utc(now()),
          endedUTC: null,
          result: "pending",
        };
        requests.push(row);
        pending.set(params.requestId, row);
      } else if (
        method === "Network.loadingFinished" ||
        method === "Network.loadingFailed"
      ) {
        const row = pending.get(params.requestId);
        if (!row) return;
        pending.delete(params.requestId);
        row.endedUTC = utc(now());
        row.result =
          method === "Network.loadingFinished"
            ? "ok"
            : errors.has(params.errorText)
              ? params.errorText
              : "OTHER_ERROR";
      }
    },
    snapshot() {
      return {
        launchedUTC: utc(launchedAt),
        windowEndUTC: utc(launchedAt + 10000),
        capturedThroughUTC: utc(Math.min(now(), launchedAt + 10000)),
        captureEnabledUTC,
        complete: now() >= launchedAt + 10000,
        requests: requests.map((r) => ({ ...r })),
        events: events.map((e) => ({ ...e })),
        requestsDropped,
        eventsDropped,
      };
    },
  };
}
