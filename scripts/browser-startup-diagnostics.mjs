// Startup-only, fixed vocabulary: never return raw Chromium stderr or environment.
export function browserStartupSummary(stderr, { exitCode, signalCode } = {}) {
  const hints = [
    ["CRASHPAD", /crashpad/i],
    ["SANDBOX", /no usable sandbox|sandbox_linux|no sandbox/i],
    ["DISK_FULL", /no space left|disk full/i],
    ["PERMISSION", /permission denied|EACCES/i],
    [
      "RESOURCE_LIMIT",
      /resource temporarily unavailable|pthread_create|cannot fork/i,
    ],
    ["PROFILE_LOCK", /ProcessSingleton|SingletonLock|profile.*in use/i],
    [
      "NAMESPACE_POLICY",
      /failed to move to new namespace|operation not permitted/i,
    ],
    ["DISPLAY", /missing X server|unable to open X display/i],
    [
      "SHARED_LIBRARY",
      /error while loading shared libraries|cannot open shared object/i,
    ],
    ["CRASH", /trace.breakpoint trap|SIGTRAP|check failed|FATAL/i],
    ["DEBUGGER_LISTENING", /DevTools listening/i],
  ]
    .filter(([, pattern]) => pattern.test(stderr))
    .map(([name]) => name);
  return {
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    signal: ["SIGTRAP", "SIGABRT", "SIGKILL", "SIGSEGV", "SIGTERM"].includes(
      signalCode,
    )
      ? signalCode
      : null,
    stderrBytes: Buffer.byteLength(stderr),
    hints,
  };
}
