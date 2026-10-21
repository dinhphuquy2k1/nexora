const LOWERCASE_HEX_64_REGEX = /^[0-9a-f]{64}$/;

/**
 * Validates whether a value is an exact 64-character lowercase hexadecimal string.
 * Format-only validation (e.g. SHA-256 digests, tokens). No implicit trimming.
 */
export function isLowercaseHex64(value: unknown): value is string {
  return typeof value === "string" && LOWERCASE_HEX_64_REGEX.test(value);
}
