BEGIN;
CREATE TABLE sync_configs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), carrier_connection_id UUID NOT NULL REFERENCES carrier_connections(id) ON DELETE CASCADE,
 sync_type VARCHAR(32) NOT NULL CHECK(sync_type IN ('SHIPMENT','CUSTOMER')), enabled BOOLEAN NOT NULL DEFAULT false,
 interval_minutes INTEGER NOT NULL CHECK(interval_minutes IN (15,30,60,120,240)), next_run_at TIMESTAMPTZ(3), last_success_at TIMESTAMPTZ(3),last_completed_at TIMESTAMPTZ(3),last_completed_watermark TEXT,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(carrier_connection_id,sync_type)
);
CREATE TABLE sync_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),carrier_connection_id UUID REFERENCES carrier_connections(id) ON DELETE SET NULL,
 owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, provider VARCHAR(32) NOT NULL,external_account_id VARCHAR(128) NOT NULL,
 sync_type VARCHAR(32) NOT NULL CHECK(sync_type IN ('SHIPMENT','CUSTOMER')),trigger_source VARCHAR(16) NOT NULL CHECK(trigger_source IN ('MANUAL','AUTO')),
 status VARCHAR(16) NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','WAITING','SUCCEEDED','FAILED','CANCELLED')),
 processing_phase VARCHAR(16) NOT NULL DEFAULT 'FETCHING' CHECK(processing_phase IN ('FETCHING','APPLYING')),
 generation INTEGER NOT NULL CHECK(generation>=0),lifecycle_version INTEGER NOT NULL CHECK(lifecycle_version>=0),
 next_page INTEGER NOT NULL DEFAULT 1 CHECK(next_page>0),next_cursor TEXT,target_watermark TEXT,
 fetched_count INTEGER NOT NULL DEFAULT 0 CHECK(fetched_count>=0),new_count INTEGER NOT NULL DEFAULT 0 CHECK(new_count>=0),changed_count INTEGER NOT NULL DEFAULT 0 CHECK(changed_count>=0),unchanged_count INTEGER NOT NULL DEFAULT 0 CHECK(unchanged_count>=0),applied_count INTEGER NOT NULL DEFAULT 0 CHECK(applied_count>=0),rejected_count INTEGER NOT NULL DEFAULT 0 CHECK(rejected_count>=0),needs_review_count INTEGER NOT NULL DEFAULT 0 CHECK(needs_review_count>=0),
 available_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),worker_id UUID,lease_version INTEGER NOT NULL DEFAULT 0 CHECK(lease_version>=0),lease_expires_at TIMESTAMPTZ(3),started_at TIMESTAMPTZ(3),finished_at TIMESTAMPTZ(3),last_error_code VARCHAR(32),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(last_error_code IS NULL OR last_error_code IN ('SYNC_UNAVAILABLE','SYNC_STALE','PROVIDER_RETRY','SOURCE_INVALID','SOURCE_CONFLICT','PROCESSOR_UNAVAILABLE','INTERNAL_ERROR'))
);
CREATE UNIQUE INDEX uq_sync_jobs_active ON sync_jobs(carrier_connection_id,sync_type) WHERE status IN ('QUEUED','RUNNING','WAITING');
CREATE INDEX idx_sync_jobs_ready ON sync_jobs(status,available_at);
CREATE INDEX idx_sync_jobs_owner ON sync_jobs(owner_user_id,carrier_connection_id,created_at DESC,id DESC);
CREATE TABLE sync_source_identities (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,provider VARCHAR(32) NOT NULL,external_account_id VARCHAR(128) NOT NULL,sync_type VARCHAR(32) NOT NULL CHECK(sync_type IN ('SHIPMENT','CUSTOMER')),
 source_key_scheme VARCHAR(64) NOT NULL,source_key TEXT NOT NULL CHECK(length(source_key)<=512 AND octet_length(source_key)<=2048),source_key_hash VARCHAR(64) NOT NULL CHECK(source_key_hash ~ '^[a-f0-9]{64}$'),
 customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,link_origin VARCHAR(32) CHECK(link_origin IN ('CREATED_BY_SYNC','LINKED_EXISTING')),
 created_by_sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE SET NULL,last_applied_sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE SET NULL,
 last_resolved_hash VARCHAR(64),resolved_processor_version INTEGER,resolved_outcome VARCHAR(32),last_observed_hash VARCHAR(64),last_applied_hash VARCHAR(64),applied_processor_version INTEGER,observed_source_version INTEGER NOT NULL DEFAULT 0 CHECK(observed_source_version>=0),last_source_order BIGINT,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key_hash),
 CHECK((customer_id IS NULL)=(link_origin IS NULL))
);
CREATE TABLE provider_source_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),source_identity_id UUID NOT NULL UNIQUE REFERENCES sync_source_identities(id) ON DELETE CASCADE,
 normalized_payload JSONB NOT NULL,payload_hash VARCHAR(64) NOT NULL,source_version INTEGER NOT NULL CHECK(source_version>0),applied_version INTEGER NOT NULL DEFAULT 0,resolved_version INTEGER NOT NULL DEFAULT 0,
 processor_version INTEGER NOT NULL CHECK(processor_version>0),applied_processor_version INTEGER,
 processing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK(processing_status IN ('PENDING','PROCESSING','RETRYABLE_ERROR','APPLIED','REJECTED_SOURCE','NEEDS_REVIEW')),attempt_count INTEGER NOT NULL DEFAULT 0,last_error_code VARCHAR(32),next_retry_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,processed_at TIMESTAMPTZ(3),
 CHECK(applied_version>=0 AND resolved_version>=applied_version AND source_version>=resolved_version),CHECK(attempt_count>=0),
 CHECK(last_error_code IS NULL OR last_error_code IN ('SOURCE_INVALID','SOURCE_CONFLICT','PROCESSOR_UNAVAILABLE','INTERNAL_ERROR'))
);
CREATE TABLE sync_job_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,source_identity_id UUID NOT NULL REFERENCES sync_source_identities(id) ON DELETE RESTRICT,
 source_version INTEGER NOT NULL CHECK(source_version>0),processor_version INTEGER NOT NULL CHECK(processor_version>0),processing_outcome VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK(processing_outcome IN ('PENDING','PROCESSING','RETRYABLE_ERROR','APPLIED','REJECTED_SOURCE','NEEDS_REVIEW')),attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),last_error_code VARCHAR(32),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,processed_at TIMESTAMPTZ(3),UNIQUE(job_id,source_identity_id,source_version,processor_version),
 CHECK(last_error_code IS NULL OR last_error_code IN ('SOURCE_INVALID','SOURCE_CONFLICT','PROCESSOR_UNAVAILABLE','INTERNAL_ERROR'))
);
CREATE INDEX idx_sync_job_items_pending ON sync_job_items(job_id,processing_outcome,id);
-- Technical coordination only: one row per in-flight acquisition. Expired tokens cannot release successors.
CREATE TABLE sync_provider_budget (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),provider VARCHAR(32) NOT NULL,slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 1),lease_token UUID,lease_expires_at TIMESTAMPTZ(3),blocked_until TIMESTAMPTZ(3),failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0),UNIQUE(provider,slot)
);
COMMIT;
