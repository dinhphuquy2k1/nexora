BEGIN;
CREATE SEQUENCE shipment_code_seq AS BIGINT START WITH 1 NO CYCLE;
CREATE FUNCTION next_shipment_code() RETURNS TEXT LANGUAGE SQL VOLATILE AS $$
 WITH n AS MATERIALIZED (SELECT nextval('public.shipment_code_seq')::text AS value)
 SELECT 'SHP' || lpad(value, greatest(6, length(value)), '0') FROM n
$$;
REVOKE ALL ON FUNCTION next_shipment_code() FROM PUBLIC;
CREATE TABLE shipments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 code VARCHAR(32) NOT NULL DEFAULT next_shipment_code(),
 source_identity_id UUID REFERENCES sync_source_identities(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 carrier_connection_id UUID REFERENCES carrier_connections(id) ON DELETE SET NULL ON UPDATE NO ACTION,
 provider VARCHAR(32),
 shipment_kind VARCHAR(32) NOT NULL DEFAULT 'RETAIL_PARCEL',
 tracking_code VARCHAR(256) NOT NULL,
 origin_warehouse VARCHAR(256),
 service_level VARCHAR(128),
 weight_kg NUMERIC(10,3),
 package_count INTEGER,
 item_count INTEGER,
 declared_value NUMERIC(18,2),
 declared_currency CHAR(3),
 total_amount NUMERIC(18,2),
 total_currency CHAR(3),
 exchange_rate NUMERIC(18,6),
 exchange_rate_at TIMESTAMPTZ(3),
 provider_status VARCHAR(128),
 logistics_stage VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
 provider_claim_status VARCHAR(128),
 provider_updated_at TIMESTAMPTZ(3),
 last_synced_at TIMESTAMPTZ(3),
 customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
 internal_note TEXT,
 updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_shipments_code UNIQUE(code),
 CONSTRAINT uq_shipments_source UNIQUE(source_identity_id),
 CONSTRAINT chk_shipments_source_provider CHECK ((source_identity_id IS NULL) = (provider IS NULL)),
 CONSTRAINT chk_shipments_provider_status CHECK (provider_status IS NULL OR provider IS NOT NULL),
 CONSTRAINT chk_shipments_kind CHECK (shipment_kind IN ('RETAIL_PARCEL')),
 CONSTRAINT chk_shipments_stage CHECK (logistics_stage IN ('TO_ORIGIN_WAREHOUSE','AT_ORIGIN_WAREHOUSE','TO_DEST_WAREHOUSE','AT_DEST_WAREHOUSE','DELIVERED','UNKNOWN')),
 CONSTRAINT chk_shipments_weight CHECK (weight_kg IS NULL OR weight_kg >= 0),
 CONSTRAINT chk_shipments_counts CHECK ((package_count IS NULL OR package_count >= 0) AND (item_count IS NULL OR item_count >= 0)),
 CONSTRAINT chk_shipments_currencies CHECK ((total_currency IS NULL OR total_currency ~ '^[A-Z]{3}$') AND (declared_currency IS NULL OR declared_currency ~ '^[A-Z]{3}$'))
);
CREATE INDEX idx_shipments_owner_stage_created ON shipments(owner_user_id,logistics_stage,created_at DESC,id DESC);
CREATE INDEX idx_shipments_owner_created ON shipments(owner_user_id,created_at DESC,id DESC);
CREATE INDEX idx_shipments_owner_tracking ON shipments(owner_user_id,tracking_code);
CREATE INDEX idx_shipments_customer ON shipments(customer_id) WHERE customer_id IS NOT NULL;
CREATE TABLE shipment_charges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 line_no SMALLINT NOT NULL,
 charge_code VARCHAR(32) NOT NULL,
 amount NUMERIC(18,2) NOT NULL,
 currency CHAR(3) NOT NULL,
 provider_label VARCHAR(256),
 CONSTRAINT uq_shipment_charges_line UNIQUE(shipment_id,line_no),
 CONSTRAINT chk_shipment_charges_line CHECK(line_no >= 1),
 CONSTRAINT chk_shipment_charges_code CHECK(charge_code IN ('UNIT_PRICE','DOMESTIC_SHIPPING','INSURANCE','COUNTING','WOOD_PACKING','BUBBLE_WRAP','OTHER')),
 CONSTRAINT chk_shipment_charges_currency CHECK(currency ~ '^[A-Z]{3}$')
);
CREATE TABLE shipment_stage_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 source_version INTEGER NOT NULL,
 processor_version INTEGER NOT NULL,
 from_stage VARCHAR(32),
 to_stage VARCHAR(32) NOT NULL,
 provider_status VARCHAR(128),
 provider_changed_at TIMESTAMPTZ(3),
 observed_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE SET NULL ON UPDATE NO ACTION,
 CONSTRAINT uq_shipment_history_version UNIQUE(shipment_id,source_version,processor_version),
 CONSTRAINT chk_shipment_history_versions CHECK(source_version > 0 AND processor_version > 0),
 CONSTRAINT chk_shipment_history_from CHECK(from_stage IS NULL OR from_stage IN ('TO_ORIGIN_WAREHOUSE','AT_ORIGIN_WAREHOUSE','TO_DEST_WAREHOUSE','AT_DEST_WAREHOUSE','DELIVERED','UNKNOWN')),
 CONSTRAINT chk_shipment_history_to CHECK(to_stage IN ('TO_ORIGIN_WAREHOUSE','AT_ORIGIN_WAREHOUSE','TO_DEST_WAREHOUSE','AT_DEST_WAREHOUSE','DELIVERED','UNKNOWN'))
);
CREATE INDEX idx_shipment_history_observed ON shipment_stage_history(shipment_id,observed_at DESC,id DESC);
ALTER TABLE shipments ADD CONSTRAINT chk_shipments_finite CHECK (
 (weight_kg IS NULL OR weight_kg <> 'NaN'::numeric) AND
 (declared_value IS NULL OR declared_value <> 'NaN'::numeric) AND
 (total_amount IS NULL OR total_amount <> 'NaN'::numeric) AND
 (exchange_rate IS NULL OR exchange_rate <> 'NaN'::numeric));
ALTER TABLE shipment_charges ADD CONSTRAINT chk_shipment_charges_finite CHECK (amount <> 'NaN'::numeric);
ALTER TABLE shipment_stage_history ADD CONSTRAINT chk_shipment_history_transition CHECK (from_stage IS NULL OR from_stage <> to_stage);
COMMIT;
