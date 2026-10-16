export const AuthLevel = { PASSWORD: "PASSWORD", MFA: "MFA" } as const;
export type AuthLevel = (typeof AuthLevel)[keyof typeof AuthLevel];
