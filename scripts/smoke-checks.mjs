import assert from "node:assert/strict";
import { get } from "node:http";

const DIAGNOSTIC_ERROR_TYPES = new Set([
  "AbortError",
  "AssertionError",
  "Error",
  "RangeError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
]);

export function createSmokeChecks(
  write = console.error,
  label = "AUTH_RUNTIME_SMOKE_FAILED",
  { diagnostics = false, now = Date.now } = {},
) {
  let step = "START";
  let stepStarted = now();
  let statuses;
  return {
    step(name) {
      step = name;
      stepStarted = now();
      statuses = undefined;
    },
    status(actual, expected) {
      statuses = {
        actual: Number.isInteger(actual) ? actual : "NOT_OBSERVED",
        expected: Number.isInteger(expected) ? expected : "NOT_SET",
      };
      assert.equal(actual, expected);
    },
    failure(error) {
      const code = error?.cause?.code ?? error?.code;
      const category = ["EAI_AGAIN", "ENOTFOUND"].includes(code)
        ? "DNS_FAILURE"
        : code === "ECONNREFUSED"
          ? "CONNECTION_REFUSED"
          : ["AbortError", "TimeoutError"].includes(error?.name)
            ? "REQUEST_TIMEOUT"
            : code === "DOCKER_TIMEOUT"
              ? "DOCKER_TIMEOUT"
              : code === "DOCKER_FAILURE"
                ? "DOCKER_FAILURE"
                : error?.name === "AssertionError"
                  ? "ASSERTION_FAILED"
                  : [
                        "SELECTOR_NOT_FOUND",
                        "CONTROL_DISABLED",
                        "FOCUS_MISMATCH",
                        "PROTOCOL_EXCEPTION",
                        "VALUE_MISMATCH",
                      ].includes(code)
                    ? code
                    : "CHECK_FAILED";
      write(label);
      write(`Step: ${step}`);
      if (statuses) {
        write(`Expected HTTP status: ${statuses.expected}`);
        write(`Actual HTTP status: ${statuses.actual}`);
      }
      write(`Category: ${category}`);
      if (diagnostics) {
        const type =
          typeof error?.name === "string" &&
          DIAGNOSTIC_ERROR_TYPES.has(error.name)
            ? error.name
            : "OTHER";
        write(`Error type: ${type}`);
        write(
          `Step elapsed ms: ${Math.max(0, Math.round(now() - stepStarted))}`,
        );
      }
    },
  };
}

/** Node fetch rewrites Host; use raw HTTP for the actual ingress-negative probe. */
export function untrustedHostStatus(url) {
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      { headers: { host: "evil.example" } },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
        response.once("error", reject);
      },
    );
    request.setTimeout(10000, () =>
      request.destroy(
        Object.assign(new Error("Host probe timeout"), {
          name: "TimeoutError",
        }),
      ),
    );
    request.once("error", reject);
  });
}
