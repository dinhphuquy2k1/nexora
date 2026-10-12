-- Nexora Uniship Operator Registration Script
--
-- Prerequisites:
--   - PostgreSQL 13+ with built-in gen_random_uuid()
--   - Execution by an authorized database administrator via psql
--
-- Usage with psql CLI:
--   psql "$DATABASE_URL" -v username='desired_operator_username' -v uniship_userid='confirmed_uniship_id' -f scripts/sql/register-uniship-operator.sql
--
-- Or interactively within a psql session:
--   \set username 'desired_operator_username'
--   \set uniship_userid 'confirmed_uniship_id'
--   \i scripts/sql/register-uniship-operator.sql
--
-- Invariants enforced:
--   - role = 'OPERATOR' (explicit, no database default)
--   - status = 'ACTIVE'
--   - provider = 'uniship'
--   - Zero rows inserted in user_credentials (OPERATOR accounts never have local passwords)
--   - Atomic transaction: rollback on input validation, duplicate username, or duplicate uniship userid

BEGIN;

DO $$
DECLARE
  v_username text := :'username';
  v_uniship_userid text := :'uniship_userid';
  v_user_id uuid;
  v_identity_id uuid;
BEGIN
  -- 1. Input validation
  IF v_username IS NULL OR length(trim(v_username)) < 3 OR length(trim(v_username)) > 50 OR v_username <> trim(v_username) THEN
    RAISE EXCEPTION 'Invalid username: must be trimmed, non-empty, and between 3 and 50 characters';
  END IF;

  IF v_uniship_userid IS NULL OR length(trim(v_uniship_userid)) = 0 OR length(v_uniship_userid) > 128 OR v_uniship_userid <> trim(v_uniship_userid) THEN
    RAISE EXCEPTION 'Invalid Uniship userid: must be trimmed, non-empty, and at most 128 characters';
  END IF;

  -- 2. Preflight uniqueness checks (database unique constraints provide final concurrency guarantee)
  IF EXISTS (SELECT 1 FROM "users" WHERE "username" = v_username) THEN
    RAISE EXCEPTION 'Username "%" is already registered in Nexora', v_username;
  END IF;

  IF EXISTS (SELECT 1 FROM "external_identities" WHERE "provider" = 'uniship' AND "provider_subject" = v_uniship_userid) THEN
    RAISE EXCEPTION 'Uniship userid "%" is already linked to an account', v_uniship_userid;
  END IF;

  -- 3. Atomic generation and insertion
  v_user_id := gen_random_uuid();
  v_identity_id := gen_random_uuid();

  INSERT INTO "users" ("id", "username", "role", "status", "created_at", "updated_at")
  VALUES (v_user_id, v_username, 'OPERATOR', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  INSERT INTO "external_identities" ("id", "user_id", "provider", "provider_subject", "created_at", "updated_at")
  VALUES (v_identity_id, v_user_id, 'uniship', v_uniship_userid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  RAISE NOTICE 'Registered OPERATOR "%" with ID % and Uniship subject "%"', v_username, v_user_id, v_uniship_userid;
END $$;

COMMIT;
