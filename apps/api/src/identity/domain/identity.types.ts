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

export interface LocalUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
