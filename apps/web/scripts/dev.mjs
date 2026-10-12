import net from "node:net";
import { spawn } from "node:child_process";

const host = process.env.HOST || "0.0.0.0";
const rawPort = process.env.PORT || "3001";
const port = parseInt(rawPort, 10);

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  console.error(`[nexora-web] Invalid PORT specified: "${rawPort}".`);
  process.exit(1);
}

function checkPortAvailability(checkPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(checkPort, "0.0.0.0");
  });
}

const available = await checkPortAvailability(port);
if (!available) {
  console.error(
    `[nexora-web] Error: Port ${port} is already in use.\n` +
      `Host development server cannot start. If Nexora is already running in Docker,\n` +
      `stop the Docker containers first or terminate the conflicting process.\n` +
      `Next.js will not silently switch to an alternative port.`,
  );
  process.exit(1);
}

const nextBin = "node_modules/next/dist/bin/next";
const child = spawn(
  process.execPath,
  [nextBin, "dev", "--webpack", "--hostname", host, "--port", String(port)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(port),
    },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
