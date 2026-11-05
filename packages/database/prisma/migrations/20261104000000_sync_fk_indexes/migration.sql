BEGIN;
CREATE INDEX idx_sync_jobs_connection ON sync_jobs(carrier_connection_id);
CREATE INDEX idx_sync_source_identities_customer ON sync_source_identities(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_sync_job_items_source ON sync_job_items(source_identity_id);
CREATE INDEX idx_sync_configs_due ON sync_configs(next_run_at) WHERE enabled;
COMMIT;
