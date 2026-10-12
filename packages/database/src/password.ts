import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

export const SCRYPT_CONFIG = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64,
};

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_CONFIG.keylen, {
    cost: SCRYPT_CONFIG.N,
    blockSize: SCRYPT_CONFIG.r,
    parallelization: SCRYPT_CONFIG.p,
    maxmem: SCRYPT_CONFIG.maxmem,
  });

  return `$scrypt$N=${SCRYPT_CONFIG.N},r=${SCRYPT_CONFIG.r},p=${SCRYPT_CONFIG.p}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 5 || parts[1] !== "scrypt") {
      return false;
    }
    const params = parts[2]
      .split(",")
      .reduce<Record<string, number>>((acc, pair) => {
        const [k, v] = pair.split("=");
        if (k && v) acc[k] = parseInt(v, 10);
        return acc;
      }, {});

    const salt = Buffer.from(parts[3], "hex");
    const expectedKey = Buffer.from(parts[4], "hex");

    const derivedKey = await scryptAsync(password, salt, expectedKey.length, {
      cost: params.N || SCRYPT_CONFIG.N,
      blockSize: params.r || SCRYPT_CONFIG.r,
      parallelization: params.p || SCRYPT_CONFIG.p,
      maxmem: SCRYPT_CONFIG.maxmem,
    });

    if (derivedKey.length !== expectedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
