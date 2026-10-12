export const UserRole = { ADMIN: "ADMIN", OPERATOR: "OPERATOR" } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserStatus = { ACTIVE: "ACTIVE", DISABLED: "DISABLED" } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
