import type { UserRole, UserStatus } from "./user-policy";
export interface UserSummary {
  id: string;
  username: string;
}

export interface SessionSummary {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface LocalLoginRecord {
  id: string;
  username: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedUser extends UserSummary {
  role: UserRole;
  status: UserStatus;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}
