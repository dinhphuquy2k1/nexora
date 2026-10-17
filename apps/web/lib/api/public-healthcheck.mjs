import { get } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeploymentPolicy } from "@nexora/shared";

/** Node fetch rewrites Host; the actual HTTP authority must satisfy the public ingress policy. */
export function probePublicWebHealth(host, port = 3000) {
  return new Promise((done) => {
    const request = get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/health/ready",
        headers: { host },
      },
      (response) => {
        response.resume();
        response.once("end", () => done(response.statusCode === 200));
        response.once("error", () => done(false));
      },
    );
    request.setTimeout(7000, () => request.destroy());
    request.once("error", () => done(false));
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const policy = loadDeploymentPolicy(process.env);
    if (!policy.publicOrigin) throw Error("Public origin required");
    process.exitCode = (await probePublicWebHealth(
      new URL(policy.publicOrigin).host,
    ))
      ? 0
      : 1;
  } catch {
    console.error("Public Web healthcheck failed");
    process.exitCode = 1;
  }
}
