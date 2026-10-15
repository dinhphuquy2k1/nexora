-- Owner-approved LEGACY_PROVIDER_SESSION_CUTOVER (2026-10-15).
-- Old sessions have no authentication-source marker. Revoke every session of
-- an OPERATOR without local credentials, including expired/disabled fixtures.
-- Preserve ADMIN and configured OPERATOR sessions, users, credentials and files.
-- Run with API/Web and provisioning writers stopped, as required by the upgrade runbook.
BEGIN;
DELETE FROM sessions AS s
USING users AS u
WHERE s.user_id = u.id
  AND u.role = 'OPERATOR'
  AND NOT EXISTS (SELECT 1 FROM user_credentials AS c WHERE c.user_id = u.id);
COMMIT;
