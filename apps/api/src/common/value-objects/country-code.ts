import { isValid as isCountry } from "i18n-iso-countries";

export class InvalidCountryCodeError extends Error {
  constructor(message = "Mã quốc gia không hợp lệ") {
    super(message);
    this.name = "InvalidCountryCodeError";
  }
}

/**
 * Domain-neutral CountryCode Value Object.
 * Encapsulates ISO 3166-1 alpha-2 validation, uppercase normalization,
 * XK exclusion, and value-based equality.
 * Throws InvalidCountryCodeError on failure.
 */
export class CountryCode {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Parses and normalizes an input string to a valid ISO 3166-1 alpha-2 code.
   */
  static parse(value: unknown): CountryCode {
    if (typeof value !== "string") {
      throw new InvalidCountryCodeError("Mã quốc gia phải là chuỗi");
    }
    const code = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !isCountry(code) || code === "XK") {
      throw new InvalidCountryCodeError("Mã quốc gia không hợp lệ");
    }
    return new CountryCode(code);
  }

  equals(other: unknown): boolean {
    return other instanceof CountryCode && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
