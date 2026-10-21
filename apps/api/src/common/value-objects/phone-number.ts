import {
  parsePhoneNumberWithError,
  type CountryCode as LibPhoneCountryCode,
} from "libphonenumber-js/max";

export class InvalidPhoneNumberError extends Error {
  constructor(message = "Số điện thoại không hợp lệ") {
    super(message);
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Domain-neutral PhoneNumber Value Object.
 * Encapsulates immutable E.164 normalization, telephone validity,
 * extension rejection, and value-based equality.
 * Throws InvalidPhoneNumberError on failure (caller maps to domain-specific error).
 */
export class PhoneNumber {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  /**
   * Parses and normalizes an input string to E.164 format.
   * @param value The raw phone number input string
   * @param defaultCountry Optional ISO 3166-1 alpha-2 default country context for national format parsing
   */
  static parse(
    value: unknown,
    defaultCountry?: LibPhoneCountryCode,
  ): PhoneNumber {
    if (typeof value !== "string") {
      throw new InvalidPhoneNumberError("Số điện thoại phải là chuỗi");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new InvalidPhoneNumberError("Số điện thoại không được để trống");
    }
    try {
      const phone = parsePhoneNumberWithError(trimmed, {
        defaultCountry,
        extract: false,
      });
      if (!phone.isValid() || phone.ext) {
        throw new InvalidPhoneNumberError(
          "Số điện thoại không hợp lệ hoặc chứa số máy lẻ",
        );
      }
      return new PhoneNumber(phone.number);
    } catch (err) {
      if (err instanceof InvalidPhoneNumberError) {
        throw err;
      }
      throw new InvalidPhoneNumberError("Số điện thoại không hợp lệ");
    }
  }

  equals(other: unknown): boolean {
    return other instanceof PhoneNumber && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
