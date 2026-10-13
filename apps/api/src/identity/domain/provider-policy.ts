export const IdentityProvider = { UNISHIP: "uniship" } as const;
export type IdentityProvider =
  (typeof IdentityProvider)[keyof typeof IdentityProvider];
