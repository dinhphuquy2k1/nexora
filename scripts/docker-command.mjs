import {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
} from "node:timers";
import { spawn } from "node:child_process";
export function dockerCommand(
  args,
  { data, timeout = 120000, interrupted = () => undefined } = {},
) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "",
      stderr = "",
      failure;
    const timer = setTimeout(() => {
      failure = "DOCKER_COMMAND_TIMEOUT";
      child.kill("SIGKILL");
    }, timeout);
    const poll = setInterval(() => {
      if (interrupted()) {
        failure = `INTERRUPTED signal=${interrupted()}`;
        child.kill("SIGKILL");
      }
    }, 50);
    child.stdout.setEncoding("utf8").on("data", (c) => {
      stdout += c;
    });
    child.stderr.setEncoding("utf8").on("data", (c) => {
      stderr += c;
    });
    child.stdin.on("error", () => {});
    child.stdin.end(data);
    child.on("error", () => {
      failure = "DOCKER_COMMAND_UNAVAILABLE";
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      if (failure) reject(Error(failure));
      else resolveCommand({ code, stdout, stderr });
    });
  });
}
