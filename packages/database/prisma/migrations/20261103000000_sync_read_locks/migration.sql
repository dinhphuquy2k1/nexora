BEGIN;
-- PostgreSQL requires UPDATE privilege for direct row-locking SELECT, including SHARE.
-- These fixed read-only capabilities let the worker lock facts without writable ACLs.
CREATE FUNCTION public.sync_lock_user(p_user_id uuid)
RETURNS TABLE(status varchar)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT u.status FROM public.users u WHERE u.id=p_user_id FOR SHARE OF u $$;
CREATE FUNCTION public.sync_lock_epoch(p_user_id uuid)
RETURNS TABLE(generation integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT s.generation FROM public.carrier_user_states s WHERE s.user_id=p_user_id FOR SHARE OF s $$;
CREATE FUNCTION public.sync_lock_connection(p_id uuid,p_owner_id uuid)
RETURNS TABLE(id uuid,user_id uuid,provider varchar,external_account_id varchar,status varchar,lifecycle_version integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT c.id,c.user_id,c.provider,c.external_account_id,c.status,c.lifecycle_version FROM public.carrier_connections c WHERE c.id=p_id AND c.user_id=p_owner_id FOR SHARE OF c $$;
CREATE FUNCTION public.sync_lock_customer(p_id uuid,p_owner_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT c.id FROM public.customers c WHERE c.id=p_id AND c.owner_user_id=p_owner_id FOR SHARE OF c $$;
REVOKE ALL ON FUNCTION public.sync_lock_user(uuid), public.sync_lock_epoch(uuid), public.sync_lock_connection(uuid,uuid), public.sync_lock_customer(uuid,uuid) FROM PUBLIC;
COMMIT;
