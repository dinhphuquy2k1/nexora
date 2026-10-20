-- Read-only integrity audit. No PII, repairs, invented addresses or arbitrary defaults.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH counts AS (
 SELECT c.id,count(a.id) AS address_count,count(a.id) FILTER (WHERE a.is_default) AS default_count
 FROM customers c LEFT JOIN customer_addresses a ON a.customer_id=c.id GROUP BY c.id
)
SELECT count(*)::int AS customer_count,
 count(*) FILTER (WHERE address_count=0)::int AS zero_address_customers,
 count(*) FILTER (WHERE address_count>0 AND default_count=0)::int AS customers_without_default,
 count(*) FILTER (WHERE default_count>1)::int AS multiple_default_customers
FROM counts;
SELECT index_class.relname AS index_name,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i JOIN pg_class index_class ON index_class.oid=i.indexrelid
JOIN pg_class parent ON parent.oid=i.indrelid JOIN pg_namespace n ON n.oid=parent.relnamespace
WHERE n.nspname='public' AND parent.relname='customer_addresses' AND index_class.relname='uq_customer_addresses_default';
COMMIT;
