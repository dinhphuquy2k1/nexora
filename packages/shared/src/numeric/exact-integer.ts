/** Plain unsigned integer text, independent of count/exponent policy. */
export function parseUnsignedIntegerText(source: unknown): string | null {
  return typeof source === "string" && /^(0|[1-9]\d{0,127})$/.test(source)
    ? source
    : null;
}
export function parseUnsignedSafeInteger(source: unknown): number | null {
  const text = parseUnsignedIntegerText(source);
  if (text === null) return null;
  const value = BigInt(text);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}
/** Exact integral decimal/exponent count; bounded before exponent arithmetic. */
export function parseNonNegativeInt32(source: unknown): number | null {
  if (typeof source !== "string" || source.length > 128) return null;
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,4}))?$/.exec(source);
  if (!m) return null;
  const coefficient = BigInt(m[2] + (m[3] ?? ""));
  if (coefficient === 0n) return 0;
  if (m[1]) return null;
  const power = Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  let result: bigint;
  if (power >= 0) {
    if (coefficient.toString().length + power > 10) return null;
    result = coefficient * 10n ** BigInt(power);
  } else {
    if (-power > 128) return null;
    const divisor = 10n ** BigInt(-power);
    if (coefficient % divisor !== 0n) return null;
    result = coefficient / divisor;
  }
  return result > 2147483647n ? null : Number(result);
}
