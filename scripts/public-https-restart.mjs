import { readFile } from "node:fs/promises";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
const session = JSON.parse(await readFile(process.argv[2], "utf8")),
  ca = await readFile(process.argv[3]),
  port = Number(process.argv[4]),
  expectedFingerprint = process.argv[5];
async function probe() {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: session.host,
        port,
        servername: session.host,
        path: "/api/auth/session",
        ca,
        agent: false,
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
        const fingerprint = res.socket.getPeerCertificate().fingerprint256;
        res.resume();
        res.once("end", () =>
          resolve(
            res.statusCode === 200 &&
              (!expectedFingerprint || fingerprint === expectedFingerprint),
          ),
        );
        res.once("error", reject);
      },
    );
    req.setTimeout(2000, () => req.destroy(Error("Timeout")));
    req.once("error", reject);
    req.end();
  });
}
try {
  let valid = false;
  for (let attempt = 0; attempt < (expectedFingerprint ? 20 : 1); attempt++) {
    try {
      valid = await probe();
    } catch {
      valid = false;
    }
    if (valid) break;
    if (expectedFingerprint) await delay(100);
  }
  if (!valid) throw Error("Session/certificate continuity failed");
  console.log("Real CA-validated HTTPS session/certificate continuity PASS");
} catch {
  console.error("HTTPS session continuity check failed");
  process.exitCode = 1;
}
