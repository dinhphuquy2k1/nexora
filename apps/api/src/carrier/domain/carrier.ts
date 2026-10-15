export const CarrierProvider = { UNISHIP: "uniship" } as const;
export const ConnectionStatus = {
  CONNECTED: "CONNECTED",
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
  ERROR: "ERROR",
} as const;
export const SecretType = {
  ACCESS_TOKEN: "ACCESS_TOKEN",
  REFRESH_TOKEN: "REFRESH_TOKEN",
  PASSWORD: "PASSWORD",
} as const;
export type CarrierProvider =
  (typeof CarrierProvider)[keyof typeof CarrierProvider];
export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];
export type SecretType = (typeof SecretType)[keyof typeof SecretType];
export interface ConnectionMetadata {
  id: string;
  provider: string;
  externalAccountId: string;
  loginIdentifier: string | null;
  displayName: string;
  status: string;
  lastVerifiedAt: Date | null;
  createdAt: Date;
}
export class CarrierError extends Error {
  constructor(readonly code: "NOT_FOUND" | "UNAUTHORIZED") {
    super(code);
  }
}
