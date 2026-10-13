import net from "node:net";
import { spawn } from "node:child_process";
import { constants } from "node:os";

export function parsePort(rawPort) {
  const port = Number(rawPort);
  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(`[nexora-web] Invalid PORT specified: "${rawPort}".`);
  }
  return port;
}

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

export async function launchNext({ mode, extraArgs = [] }) {
  const host = process.env.HOST || "0.0.0.0";
  let port;
  try {
    port = parsePort(process.env.PORT ?? "3001");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (!(await checkPortAvailability(port))) {
    const detail =
      mode === "dev"
        ? "Host development server cannot start. If Nexora is already running in Docker,\n" +
          "stop the Docker containers first or stop the conflicting process after inspecting it.\n"
        : "Host server cannot start. Port collision detected.\nInspect the listener or configure a free PORT before retrying.\n";
    console.error(
      `[nexora-web] Error: Port ${port} is already in use.\n${detail}` +
        "Next.js will not silently switch to an alternative port.",
    );
    process.exitCode = 1;
    return;
  }

  let child;
  try {
    child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        mode,
        ...extraArgs,
        "--hostname",
        host,
        "--port",
        String(port),
      ],
      { stdio: "inherit", env: { ...process.env, PORT: String(port) } },
    );
  } catch {
    console.error("[nexora-web] Unable to start Next.js.");
    process.exitCode = 1;
    return;
  }

  await new Promise((resolve) => {
    let spawnFailed = false;
    let stopSignal;
    const handlers = new Map();
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      const forward = () => {
        stopSignal ??= signal;
        child.kill(signal);
      };
      handlers.set(signal, forward);
      process.on(signal, forward);
    }
    child.once("error", () => {
      spawnFailed = true;
      console.error("[nexora-web] Unable to start Next.js.");
    });
    // Wait for close so inherited streams and the child finish before exiting.
    child.once("close", (code, signal) => {
      for (const [name, handler] of handlers) process.off(name, handler);
      const terminatedBy = stopSignal ?? signal;
      process.exitCode = spawnFailed
        ? 1
        : terminatedBy
          ? 128 + (constants.signals[terminatedBy] ?? 1)
          : (code ?? 1);
      resolve();
    });
  });
}
