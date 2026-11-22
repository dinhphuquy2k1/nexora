BEGIN;

CREATE TABLE sync_job_seen_pages (
  job_id UUID NOT NULL,
  page_no INTEGER NOT NULL,
  source_identity_ids UUID[] NOT NULL,
  reported_total INTEGER NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sync_job_seen_pages_pkey PRIMARY KEY (job_id, page_no),
  CONSTRAINT fk_sync_job_seen_pages_job FOREIGN KEY (job_id) REFERENCES sync_jobs(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT chk_sync_seen_page_number CHECK (page_no >= 1),
  CONSTRAINT chk_sync_seen_reported_total CHECK (reported_total >= 0),
  CONSTRAINT chk_sync_seen_ids CHECK (
    cardinality(source_identity_ids) <= 500 AND
    CASE
      WHEN cardinality(source_identity_ids) = 0 THEN TRUE
      WHEN array_ndims(source_identity_ids) = 1 AND array_lower(source_identity_ids, 1) = 1
        THEN array_position(source_identity_ids, NULL) IS NULL
      ELSE FALSE
    END
  )
);

ALTER TABLE sync_jobs
  ADD COLUMN scan_integrity_status VARCHAR(16),
  ADD COLUMN scan_integrity_reason VARCHAR(32),
  ADD COLUMN scan_observed_count INTEGER,
  ADD COLUMN scan_reported_total INTEGER,
  ADD COLUMN scan_scope_fingerprint VARCHAR(64),
  ADD CONSTRAINT chk_sync_scan_status CHECK (scan_integrity_status IN ('VALIDATED', 'INCOMPLETE', 'UNTRUSTED')),
  ADD CONSTRAINT chk_sync_scan_reason CHECK (scan_integrity_reason IN (
    'MISSING_SCAN_METADATA', 'SCOPE_MISMATCH', 'TOTAL_MISMATCH', 'DUPLICATE_IDENTITY',
    'PAGE_GAP', 'MISSING_TERMINAL_PAGE', 'COUNT_MISMATCH'
  )),
  ADD CONSTRAINT chk_sync_scan_counts CHECK (scan_observed_count >= 0 AND scan_reported_total >= 0),
  ADD CONSTRAINT chk_sync_scan_fingerprint CHECK (scan_scope_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT chk_sync_scan_summary CHECK (
    CASE
      WHEN scan_integrity_status IS NULL THEN scan_integrity_reason IS NULL AND scan_observed_count IS NULL AND scan_reported_total IS NULL
      WHEN scan_integrity_status = 'VALIDATED' THEN scan_integrity_reason IS NULL AND scan_scope_fingerprint IS NOT NULL AND scan_observed_count IS NOT NULL AND scan_reported_total IS NOT NULL AND scan_observed_count = scan_reported_total
      ELSE scan_integrity_reason IS NOT NULL AND scan_observed_count IS NOT NULL
    END
  );

COMMIT;
