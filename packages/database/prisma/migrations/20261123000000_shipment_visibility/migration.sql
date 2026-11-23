ALTER TABLE shipments
 ADD COLUMN sync_hidden_at TIMESTAMPTZ(3),
 ADD COLUMN missing_streak INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT chk_shipments_sync_visibility CHECK (
  (sync_hidden_at IS NULL AND missing_streak=0) OR
  (sync_hidden_at IS NOT NULL AND missing_streak>=1)
 );
ALTER TABLE sync_jobs
 ADD COLUMN reconciliation_version INTEGER CHECK (reconciliation_version>=1),
 ADD COLUMN reconciliation_status VARCHAR(24),
 ADD COLUMN reconciliation_reason VARCHAR(40),
 ADD COLUMN reconciliation_newly_hidden_count INTEGER,
 ADD COLUMN reconciliation_restored_count INTEGER,
 ADD COLUMN reconciliation_still_missing_count INTEGER,
 ADD CONSTRAINT chk_sync_jobs_reconciliation_status CHECK (reconciliation_status IN ('APPLIED','BASELINE_ESTABLISHED','SKIPPED')),
 ADD CONSTRAINT chk_sync_jobs_reconciliation_reason CHECK (reconciliation_reason IN ('CAPABILITY_NOT_ADMITTED','SCAN_NOT_VALIDATED','SCOPE_MISMATCH','BASELINE_UNAVAILABLE','POLICY_NOT_CONFIGURED','MASS_HIDE_THRESHOLD_EXCEEDED','ZERO_RESULT_ANOMALY','SOURCE_SCOPE_CONFLICT','STREAK_LIMIT_REACHED')),
 ADD CONSTRAINT chk_sync_jobs_reconciliation_summary CHECK (
  (reconciliation_status IS NULL AND reconciliation_reason IS NULL AND reconciliation_newly_hidden_count IS NULL AND reconciliation_restored_count IS NULL AND reconciliation_still_missing_count IS NULL)
  OR (reconciliation_status IS NOT NULL AND reconciliation_newly_hidden_count IS NOT NULL AND reconciliation_newly_hidden_count>=0 AND reconciliation_restored_count IS NOT NULL AND reconciliation_restored_count>=0 AND reconciliation_still_missing_count IS NOT NULL AND reconciliation_still_missing_count>=0 AND
   ((reconciliation_status='APPLIED' AND reconciliation_reason IS NULL) OR
    (reconciliation_status='BASELINE_ESTABLISHED' AND reconciliation_reason IS NULL AND reconciliation_newly_hidden_count=0 AND reconciliation_restored_count=0 AND reconciliation_still_missing_count=0) OR
    (reconciliation_status='SKIPPED' AND reconciliation_reason IS NOT NULL AND reconciliation_newly_hidden_count=0 AND reconciliation_restored_count=0 AND reconciliation_still_missing_count=0)))
 );
