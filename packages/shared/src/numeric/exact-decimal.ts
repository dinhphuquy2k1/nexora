/** Lexical predicate only: no precision, scale, or business range policy. */
export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value);
}
/** Exact decimal validation and zero padding; never rounds or converts through Number. */
export function parseExactDecimal(
  input: unknown,
  precision: number,
  scale: number,
): string | null {
  if (!isDecimalString(input)) return null;
  const [integer, fraction = ""] = input.replace(/^-/, "").split(".");
  if (integer.length > precision - scale || fraction.length > scale)
    return null;
  const sign =
    input.startsWith("-") && /[1-9]/.test(integer + fraction) ? "-" : "";
  return sign + integer + "." + fraction.padEnd(scale, "0");
}
