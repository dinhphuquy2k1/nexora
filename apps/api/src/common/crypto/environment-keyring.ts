import { CryptoFailure, type KeyProvider } from "./secret-cipher";
/** Lazy validation isolates key custody errors from Login and metadata startup.
 * Snapshot server config at construction. Rotation requires an API restart.
 */
export class EnvironmentKeyring implements KeyProvider {
  private readonly encoded: string | undefined;
  private readonly active: string | undefined;
  constructor(
    env: Readonly<Record<string, string | undefined>>,
    namespace: "CARRIER" | "IDENTITY" = "CARRIER",
  ) {
    this.encoded = env[`${namespace}_KEYRING_JSON`];
    this.active = env[`${namespace}_ACTIVE_KEY_VERSION`];
  }
  private parse() {
    try {
      if (!this.encoded || !this.active || !/^[1-9][0-9]*$/.test(this.active))
        throw new CryptoFailure();
      const active = Number(this.active),
        entries: unknown = JSON.parse(this.encoded);
      if (
        !Number.isSafeInteger(active) ||
        active > 2147483647 ||
        !entries ||
        typeof entries !== "object" ||
        Array.isArray(entries)
      )
        throw new CryptoFailure();
      const keys = new Map<number, Buffer>();
      for (const [version, value] of Object.entries(entries)) {
        if (
          !/^[1-9][0-9]*$/.test(version) ||
          !Number.isSafeInteger(Number(version)) ||
          Number(version) > 2147483647 ||
          typeof value !== "string"
        )
          throw new CryptoFailure();
        const key = Buffer.from(value, "base64");
        if (key.length !== 32 || key.toString("base64") !== value)
          throw new CryptoFailure();
        keys.set(Number(version), key);
      }
      if (!keys.has(active)) throw new CryptoFailure();
      return { active, keys };
    } catch {
      throw new CryptoFailure();
    }
  }
  activeVersion() {
    return this.parse().active;
  }
  key(version: number) {
    const key = this.parse().keys.get(version);
    if (!key) throw new CryptoFailure();
    return key;
  }
}
