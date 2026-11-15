BEGIN;
CREATE TABLE shipment_services (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL,
 service_code VARCHAR(32) NOT NULL,
 enabled BOOLEAN NOT NULL,
 CONSTRAINT fk_shipment_services_shipment FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 CONSTRAINT uq_shipment_services_code UNIQUE(shipment_id,service_code),
 CONSTRAINT chk_shipment_services_code CHECK(service_code IN ('INSURANCE','COUNTING','FRAGILE_GOODS','FOAM'))
);
COMMIT;
