BEGIN;
CREATE TABLE shipment_milestones (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 milestone_code VARCHAR(32) NOT NULL,
 occurred_at TIMESTAMPTZ(3) NOT NULL,
 location_name VARCHAR(256),
 provider_label VARCHAR(256),
 CONSTRAINT uq_shipment_milestones_code UNIQUE(shipment_id,milestone_code),
 CONSTRAINT chk_shipment_milestones_code CHECK(milestone_code IN ('ORIGIN_RECEIVED','ORIGIN_DISPATCHED','DEST_RECEIVED','DEST_DISPATCHED'))
);
CREATE TABLE shipment_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 line_no SMALLINT NOT NULL,
 name VARCHAR(512) NOT NULL,
 quantity INTEGER,
 unit_value NUMERIC(18,2),
 currency CHAR(3),
 CONSTRAINT uq_shipment_items_line UNIQUE(shipment_id,line_no),
 CONSTRAINT chk_shipment_items_line CHECK(line_no >= 1),
 CONSTRAINT chk_shipment_items_name CHECK(length(btrim(name)) > 0),
 CONSTRAINT chk_shipment_items_quantity CHECK(quantity IS NULL OR quantity >= 0),
 CONSTRAINT chk_shipment_items_value_pair CHECK((unit_value IS NULL) = (currency IS NULL)),
 CONSTRAINT chk_shipment_items_value_finite CHECK(unit_value IS NULL OR unit_value <> 'NaN'::numeric),
 CONSTRAINT chk_shipment_items_value_nonneg CHECK(unit_value IS NULL OR unit_value >= 0),
 CONSTRAINT chk_shipment_items_currency CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$')
);
COMMIT;
