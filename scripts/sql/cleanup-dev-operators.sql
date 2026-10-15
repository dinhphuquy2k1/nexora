-- OPTIONAL development maintenance only; never invoked by startup or CI.
-- psql -X -v ON_ERROR_STOP=1 "$DEV_DATABASE_URL" -v deployment_env=development \
--   -v expected_database=nexora_dev_test -v username_prefix=test_demo \
--   -v dry_run=true -v confirmation=NONE -f scripts/sql/cleanup-dev-operators.sql
-- To execute after reviewing dry-run count: dry_run=false, confirmation=DELETE_TEST_OPERATORS.
-- Only credentialless OPERATOR accounts with this explicit test_ prefix qualify.
\set ON_ERROR_STOP on
\if :{?dry_run}
\else
\set dry_run true
\endif
\if :{?confirmation}
\else
\set confirmation NONE
\endif
BEGIN;
CREATE TEMP TABLE cleanup_input ON COMMIT DROP AS
 SELECT :'deployment_env'::text AS deployment_env, :'expected_database'::text AS expected_database,
        :'username_prefix'::text AS username_prefix, :'dry_run'::boolean AS dry_run, :'confirmation'::text AS confirmation;
DO $$
DECLARE settings record; candidate_count bigint;
BEGIN
 SELECT * INTO STRICT settings FROM pg_temp.cleanup_input;
 IF settings.deployment_env <> 'development'
    OR current_database() <> settings.expected_database
    OR current_database() !~ '^nexora_(dev|test)_[a-zA-Z0-9_]+$'
    OR settings.username_prefix !~ '^test_[a-zA-Z0-9]{4,}$' THEN
   RAISE EXCEPTION 'Refusing cleanup: development database and explicit test prefix required';
 END IF;
 IF NOT settings.dry_run AND settings.confirmation <> 'DELETE_TEST_OPERATORS' THEN
   RAISE EXCEPTION 'Refusing cleanup without exact explicit confirmation';
 END IF;
 -- Lock users first, then let deletion cascade sessions/setup tokens; never ADMIN.
 PERFORM u.id FROM users u WHERE u.role='OPERATOR'
   AND starts_with(u.username,settings.username_prefix)
   AND NOT EXISTS (SELECT 1 FROM user_credentials c WHERE c.user_id=u.id)
   ORDER BY u.id FOR UPDATE;
 SELECT count(*) INTO candidate_count FROM users u WHERE u.role='OPERATOR'
   AND starts_with(u.username,settings.username_prefix)
   AND NOT EXISTS (SELECT 1 FROM user_credentials c WHERE c.user_id=u.id);
 IF settings.dry_run THEN RAISE NOTICE 'Dry run: % credentialless test operators eligible',candidate_count;
 ELSE
   DELETE FROM users u WHERE u.role='OPERATOR' AND starts_with(u.username,settings.username_prefix)
     AND NOT EXISTS (SELECT 1 FROM user_credentials c WHERE c.user_id=u.id);
   RAISE NOTICE 'Explicit development cleanup completed';
 END IF;
END $$;
COMMIT;
