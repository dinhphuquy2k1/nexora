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
    // Only the format emitted since initial provisioning is supported. Validate
    // encoding and all costs before decoding or allocating scrypt work.
    const match =
      /^\$scrypt\$N=16384,r=8,p=1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(
        storedHash,
      );
    if (!match || match[0] !== storedHash) return false;
    const salt = Buffer.from(match[1], "hex");
    const expectedKey = Buffer.from(match[2], "hex");
    const derivedKey = await scryptAsync(password, salt, SCRYPT_CONFIG.keylen, {
      cost: SCRYPT_CONFIG.N,
      blockSize: SCRYPT_CONFIG.r,
      parallelization: SCRYPT_CONFIG.p,
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
