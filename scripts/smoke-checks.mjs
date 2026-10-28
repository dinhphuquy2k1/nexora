import assert from "node:assert/strict";
import { get } from "node:http";

export function createSmokeChecks(
  write = console.error,
  label = "AUTH_RUNTIME_SMOKE_FAILED",
) {
  let step = "START";
  let statuses;
  return {
    step(name) {
      step = name;
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
