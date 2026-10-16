BEGIN;
ALTER TABLE sessions ADD COLUMN auth_level VARCHAR(16) NOT NULL DEFAULT 'PASSWORD';
ALTER TABLE sessions ADD CONSTRAINT chk_sessions_auth_level CHECK (auth_level IN ('PASSWORD','MFA'));
CREATE TABLE user_mfa (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 totp_secret_ciphertext TEXT NOT NULL,
 nonce VARCHAR(64) NOT NULL,
 auth_tag VARCHAR(64) NOT NULL,
 key_version INTEGER NOT NULL CHECK (key_version > 0),
 last_used_step BIGINT NOT NULL CHECK (last_used_step >= 0),
 enabled_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE mfa_challenges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 token_hash VARCHAR(64) NOT NULL,
 expires_at TIMESTAMPTZ(3) NOT NULL,
 consumed_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX mfa_challenges_token_hash_key ON mfa_challenges(token_hash);
CREATE INDEX mfa_challenges_user_id_idx ON mfa_challenges(user_id);
CREATE INDEX mfa_challenges_expires_at_idx ON mfa_challenges(expires_at);
CREATE TABLE mfa_recovery_codes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES user_mfa(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
 code_hash VARCHAR(64) NOT NULL,
 used_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX mfa_recovery_codes_user_id_code_hash_key ON mfa_recovery_codes(user_id,code_hash);
COMMIT;
