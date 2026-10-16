import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** RFC6238 SHA1, six decimal digits,30-second steps. No secret in error messages. */
export function totpAt(secret: Buffer, step: number): string {
  if (secret.length !== 20 || !Number.isSafeInteger(step) || step < 0)
    throw new Error("MFA_INPUT_INVALID");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return value.toString().padStart(6, "0");
}
export function matchTotpStep(
  secret: Buffer,
  code: unknown,
  now: number,
): number | null {
  if (
    typeof code !== "string" ||
    !/^[0-9]{6}$/.test(code) ||
    !Number.isFinite(now) ||
    now < 30000
  )
    return null;
  const current = Math.floor(now / 30000);
  let matched: number | null = null;
  // Evaluate the whole accepted window, including leading zeros, before returning.
  for (const offset of [-1, 0, 1]) {
    const step = current + offset;
    if (timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code)))
      matched = step;
  }
  return matched;
}
export function generateTotpSecret(): Buffer {
  return randomBytes(20);
}
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () =>
    randomBytes(16).toString("hex").toUpperCase().match(/.{8}/g)!.join("-"),
  );
}
export function hashRecoveryCode(code: unknown): string | null {
  if (
    typeof code !== "string" ||
    !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{8}){3}$/.test(code)
  )
    return null;
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}
export function encodeBase32(secret: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of secret) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
