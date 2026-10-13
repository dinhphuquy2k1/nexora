import type { IdentityProvider } from "./provider-policy";
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

export interface ExternalIdentityRecord {
  id: string;
  userId: string;
  provider: IdentityProvider;
  providerSubject: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
  };
}

export interface VerifiedProviderIdentity {
  provider: IdentityProvider;
  providerSubject: string;
}
