import { readFile } from "node:fs/promises";
import { request } from "node:https";
const session = JSON.parse(await readFile(process.argv[2], "utf8")),
  ca = await readFile(process.argv[3]),
  port = Number(process.argv[4]);
try {
  await new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: session.host,
        port,
        servername: session.host,
        path: "/api/auth/session",
        ca,
        headers: {
          host: `${session.host}:${port}`,
          cookie: `nexora_session=${session.token}`,
        },
        lookup: (_name, options, callback) =>
          options.all
            ? callback(null, [{ address: "127.0.0.1", family: 4 }])
            : callback(null, "127.0.0.1", 4),
      },
      (res) => {
        res.resume();
        res.once("end", () =>
          res.statusCode === 200
            ? resolve()
            : reject(Error("Session not preserved")),
        );
        res.once("error", reject);
      },
    );
    req.setTimeout(10000, () => req.destroy(Error("Timeout")));
    req.once("error", reject);
    req.end();
  });
  console.log(
    "Real CA-validated HTTPS session survives API/Web/ingress restart PASS",
  );
} catch {
  console.error("HTTPS restart session check failed");
  process.exitCode = 1;
}
