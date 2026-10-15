BEGIN;
CREATE TABLE operator_setup_tokens (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 issued_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 expires_at TIMESTAMPTZ(3) NOT NULL,
 consumed_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX operator_setup_tokens_user_id_idx ON operator_setup_tokens(user_id);
DROP TABLE external_identities;
COMMIT;
