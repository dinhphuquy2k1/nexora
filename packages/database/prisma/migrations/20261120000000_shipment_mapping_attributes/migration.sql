-- Additive provider-owned facts. Existing rows remain NULL; no backfill or identity change.
ALTER TABLE shipments
 ADD COLUMN actual_package_count INTEGER,
 ADD COLUMN provider_paid_amount NUMERIC(18,2),
 ADD COLUMN provider_remaining_amount NUMERIC(18,2),
 ADD COLUMN provider_paid_at TIMESTAMPTZ(3),
 ADD COLUMN destination_warehouse VARCHAR(256),
 ADD COLUMN provider_attributes JSONB,
 ADD CONSTRAINT chk_shipments_actual_package_count CHECK (actual_package_count IS NULL OR actual_package_count >= 0),
 ADD CONSTRAINT chk_shipments_provider_paid CHECK (provider_paid_amount IS NULL OR (provider_paid_amount <> 'NaN'::numeric AND provider_paid_amount >= 0)),
 ADD CONSTRAINT chk_shipments_provider_remaining CHECK (provider_remaining_amount IS NULL OR (provider_remaining_amount <> 'NaN'::numeric AND provider_remaining_amount >= 0)),
 -- Domain uses the stricter compact UTF8 limit1024; JSONB text overhead gets physical limit2048.
 ADD CONSTRAINT chk_shipments_provider_attributes CHECK (provider_attributes IS NULL OR (
   jsonb_typeof(provider_attributes)='object'
   AND provider_attributes ?& ARRAY['schemaVersion','provider','values']
   AND provider_attributes - ARRAY['schemaVersion','provider','values']::text[] = '{}'::jsonb
   AND provider_attributes->'schemaVersion'='1'::jsonb
   AND jsonb_typeof(provider_attributes->'provider')='string'
   AND provider_attributes->>'provider'=provider
   AND jsonb_typeof(provider_attributes->'values')='object'
   AND octet_length(provider_attributes::text)<=2048
 ) IS TRUE);
ALTER TABLE shipment_charges DROP CONSTRAINT chk_shipment_charges_code;
ALTER TABLE shipment_charges ADD CONSTRAINT chk_shipment_charges_code CHECK(charge_code IN ('UNIT_PRICE','DOMESTIC_SHIPPING','INSURANCE','COUNTING','WOOD_PACKING','BUBBLE_WRAP','OTHER','WEIGHT_FREIGHT'));
