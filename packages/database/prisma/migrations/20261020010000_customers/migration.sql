BEGIN;
CREATE SEQUENCE customer_code_seq AS BIGINT START WITH 1 NO CYCLE;
CREATE FUNCTION next_customer_code() RETURNS TEXT LANGUAGE SQL VOLATILE AS $$
 WITH n AS MATERIALIZED (SELECT nextval('public.customer_code_seq')::text AS value)
 SELECT 'KH' || lpad(value, greatest(6, length(value)), '0') FROM n
$$;
CREATE TABLE customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 code VARCHAR(32) NOT NULL DEFAULT next_customer_code(),
 name VARCHAR(200) NOT NULL,
 phone_normalized VARCHAR(16) NOT NULL,
 email VARCHAR(254),
 note TEXT,
 status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
 created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_customers_status CHECK (status IN ('ACTIVE','INACTIVE'))
);
CREATE UNIQUE INDEX uq_customers_code ON customers(code);
CREATE UNIQUE INDEX uq_customers_owner_phone ON customers(owner_user_id,phone_normalized);
CREATE INDEX idx_customers_owner_created ON customers(owner_user_id,created_at DESC,id DESC);
CREATE INDEX idx_customers_owner_status_created ON customers(owner_user_id,status,created_at DESC,id DESC);
CREATE TABLE customer_addresses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
 label VARCHAR(100),
 recipient_name VARCHAR(200) NOT NULL,
 recipient_phone VARCHAR(16) NOT NULL,
 country_code VARCHAR(2) NOT NULL DEFAULT 'VN',
 address_text TEXT NOT NULL,
 is_default BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customer_addresses_customer_created ON customer_addresses(customer_id,created_at,id);
CREATE UNIQUE INDEX uq_customer_addresses_default ON customer_addresses(customer_id) WHERE is_default = true;
REVOKE ALL ON FUNCTION next_customer_code() FROM PUBLIC;
COMMIT;
