BEGIN;
ALTER TABLE carrier_connections ADD COLUMN lifecycle_version INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT chk_carrier_lifecycle_version CHECK (lifecycle_version >= 0);
CREATE TABLE carrier_user_states (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 generation INTEGER NOT NULL DEFAULT 0 CHECK (generation >= 0)
);
CREATE TABLE security_audit_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('PASSWORD_DECRYPT','CONNECT','RECONNECT','RECOVERY')),
 outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('ALLOWED','SUCCESS','FAILURE')),
 reason VARCHAR(32) NOT NULL CHECK (reason IN ('RECOVERY_REQUESTED','VERIFIED','INVALID_CREDENTIALS','DUPLICATE_ACCOUNT','IDENTITY_MISMATCH','UNAVAILABLE')),
 user_id UUID, connection_id UUID,
 provider VARCHAR(32) NOT NULL CHECK (provider IN ('uniship')),
 correlation_id UUID NOT NULL
);
CREATE INDEX idx_security_audit_connection_time ON security_audit_events(connection_id,created_at);
CREATE FUNCTION reject_security_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'security audit is append only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER security_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON security_audit_events
 FOR EACH STATEMENT EXECUTE FUNCTION reject_security_audit_mutation();
COMMIT;
