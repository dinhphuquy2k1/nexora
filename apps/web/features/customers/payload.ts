import type {
  AddressDraft,
  Address,
  AddressCreate,
  AddressPatch,
  ProfileDraft,
  Summary,
  Create,
  Patch,
} from "./types.ts";
import {
  CustomerStatus,
  CustomerInputLimits,
  normalizeBoundedText,
  normalizeRawBoundedText,
} from "@nexora/shared";
export class DraftError extends Error {
  field: string;
  constructor(field: string) {
    super("Kiểm tra các trường bắt buộc và độ dài cho phép.");
    this.field = field;
  }
}
function text(
  value: string | undefined,
  max: number,
  field: string,
  required = true,
) {
  const v = normalizeBoundedText(value ?? "", max, required);
  if (v === null) throw new DraftError(field);
  return v;
}
function phone(value: string | undefined, field: string, required = true) {
  const v = normalizeRawBoundedText(
    value ?? "",
    CustomerInputLimits.PHONE_RAW,
    required,
  );
  if (v === null) throw new DraftError(field);
  return v;
}
const profile = (d: ProfileDraft) => ({
  name: text(d.name, CustomerInputLimits.NAME, "name"),
  phone: phone(d.phone, "phone"),
  email: text(d.email, CustomerInputLimits.EMAIL, "email", false),
  note: text(d.note, CustomerInputLimits.NOTE, "note", false),
});
export function createCustomerPayload(
  d: ProfileDraft,
  a: Partial<AddressDraft>,
): Create {
  const p = profile(d);
  const out: Create = {
    name: p.name,
    phone: p.phone,
    address: addressPayload(a),
  };
  if (p.email) out.email = p.email;
  if (p.note) out.note = p.note;
  return out;
}
export function patchCustomerPayload(
  d: ProfileDraft,
  old: Pick<Summary, "name" | "phone" | "email" | "note" | "status">,
): Patch {
  const p = profile(d),
    out: Patch = {};
  if (p.name !== old.name) out.name = p.name;
  if (p.phone !== old.phone) out.phone = p.phone;
  if ((p.email || null) !== old.email) out.email = p.email || null;
  if ((p.note || null) !== old.note) out.note = p.note || null;
  if (d.status !== undefined) {
    if (
      d.status !== CustomerStatus.ACTIVE &&
      d.status !== CustomerStatus.INACTIVE
    )
      throw new DraftError("status");
    if (d.status !== old.status) out.status = d.status;
  }
  if (!Object.keys(out).length) throw new DraftError("unchanged");
  return out;
}
export function addressPayload(d: Partial<AddressDraft>): AddressCreate;
export function addressPayload(
  d: Partial<AddressDraft>,
  old: Address,
): AddressPatch;
export function addressPayload(
  d: Partial<AddressDraft>,
  old?: Address,
): AddressCreate | AddressPatch {
  const countryCode = text(
    d.countryCode ?? "VN",
    CustomerInputLimits.COUNTRY_CODE,
    "countryCode",
  );
  if (countryCode.length !== 2) throw new DraftError("countryCode");
  const values = {
    label:
      text(d.label, CustomerInputLimits.ADDRESS_LABEL, "label", false) || null,
    recipientName: text(
      d.recipientName,
      CustomerInputLimits.RECIPIENT_NAME,
      "recipientName",
      !old ? false : true,
    ),
    recipientPhone: phone(
      d.recipientPhone,
      "recipientPhone",
      !old ? false : true,
    ),
    addressText: text(
      d.addressText,
      CustomerInputLimits.ADDRESS_TEXT,
      "addressText",
    ),
  };
  if (!old) {
    const out: AddressCreate = { countryCode, addressText: values.addressText };
    if (values.label) out.label = values.label;
    if (values.recipientName) out.recipientName = values.recipientName;
    if (values.recipientPhone) out.recipientPhone = values.recipientPhone;
    return out;
  }
  const out: AddressPatch = { countryCode };
  for (const k of [
    "label",
    "recipientName",
    "recipientPhone",
    "addressText",
  ] as const) {
    if (values[k] !== old[k]) Object.assign(out, { [k]: values[k] });
  }
  if (Object.keys(out).length === 1 && countryCode === old.countryCode)
    throw new DraftError("unchanged");
  return out;
}
