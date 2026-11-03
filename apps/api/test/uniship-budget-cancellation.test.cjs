const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  UnishipAdapter,
} = require("../dist/carrier/infrastructure/uniship/uniship-adapter");
const {
  UnishipHttpClient,
} = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
for (const phase of ["authenticate", "verify"]) {
  test(
    `reservation loss cancels actual ${phase} HTTP and cannot return acquisition success`,
    { timeout: 10000 },
    async (t) => {
      const entered = Promise.withResolvers(),
        closed = Promise.withResolvers();
      const controller = new globalThis.AbortController(),
        calls = [];
      const server = http.createServer((req, res) => {
        calls.push(req.url);
        if (phase === "authenticate" || req.url.endsWith("api-token-verify/")) {
          res.on("close", () => closed.resolve());
          entered.resolve();
          return;
        }
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            token: "synthetic-candidate",
            user: { userid: 12345 },
          }),
        );
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      });
      // Deliberately longer than the test deadline: timeout cannot masquerade as cancellation.
      const client = new UnishipHttpClient({
        apiUrl: `http://127.0.0.1:${server.address().port}`,
        timeoutMs: 60000,
      });
      const adapter = new UnishipAdapter(client, {
        run: (operation) => operation(controller.signal),
      });
      const acquisition = adapter.acquire(
        "synthetic-user",
        "synthetic-password",
      );
      const failure = assert.rejects(
        acquisition,
        (e) => e.code === "SERVICE_UNAVAILABLE",
      );
      await entered.promise;
      controller.abort();
      await Promise.all([failure, closed.promise]);
      assert.equal(calls.length, phase === "authenticate" ? 1 : 2);
    },
  );
}
