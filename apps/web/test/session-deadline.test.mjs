import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { verifyServerSession } from "../lib/api/session.ts";

for (const mode of ["headers", "body"]) {
  test(
    `session deadline aborts stalled ${mode} with real HTTP`,
    { timeout: 10000 },
    async () => {
      let received = false;
      let closed;
      const aborted = new Promise((resolve) => {
        closed = resolve;
      });
      const server = createServer((request, response) => {
        received = true;
        response.on("close", closed);
        if (mode === "body") {
          response.writeHead(200, { "content-type": "application/json" });
          response.write('{"authenticated":true,');
        }
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const previous = process.env.API_INTERNAL_URL;
      process.env.API_INTERNAL_URL = `http://127.0.0.1:${server.address().port}`;
      try {
        const result = await Promise.race([
          verifyServerSession("synthetic-token"),
          new Promise((resolve) =>
            setTimeout(() => resolve({ status: "test-timeout" }), 6000).unref(),
          ),
        ]);
        assert.equal(received, true);
        assert.equal(result.status, "unavailable");
        assert.equal(
          await Promise.race([
            aborted.then(() => true),
            new Promise((resolve) =>
              setTimeout(() => resolve(false), 1000).unref(),
            ),
          ]),
          true,
        );
      } finally {
        if (previous === undefined) delete process.env.API_INTERNAL_URL;
        else process.env.API_INTERNAL_URL = previous;
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    },
  );
}
