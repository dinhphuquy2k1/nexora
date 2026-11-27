import { createHmac } from "node:crypto";
// Independent RFC6238 SHA1 fixture generator extracted from browser smoke.
export function totpAtStep(key, step) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    v = 0,
    bytes = [];
  for (const c of key) {
    v = (v << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((v >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
    at = mac.at(-1) & 15;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1000000).padStart(6, "0");
}

export function totp(key, offset = 0) {
  return totpAtStep(key, Math.floor(Date.now() / 30000) + offset);
}
