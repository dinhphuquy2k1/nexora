BEGIN;
-- Purpose-specific capabilities; no data or historical migration changes.
CREATE OR REPLACE FUNCTION public._sync_carrier_context(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.sync_jobs%ROWTYPE;c public.carrier_connections%ROWTYPE;g integer;u varchar;
BEGIN
 SELECT * INTO j FROM public.sync_jobs WHERE id=p_job;
 IF NOT FOUND OR j.carrier_connection_id IS NULL OR p_operation IS NULL OR p_worker IS NULL OR p_lease IS NULL OR p_lease<1 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 SELECT status INTO u FROM public.users WHERE id=j.owner_user_id FOR SHARE;
 SELECT generation INTO g FROM public.carrier_user_states WHERE user_id=j.owner_user_id FOR SHARE;
 SELECT * INTO c FROM public.carrier_connections WHERE id=j.carrier_connection_id AND user_id=j.owner_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.sync_jobs WHERE id=p_job FOR SHARE;
 IF NOT FOUND OR u IS DISTINCT FROM 'ACTIVE' OR g IS DISTINCT FROM j.generation OR j.status<>'RUNNING' OR
    j.worker_id IS DISTINCT FROM p_worker OR j.lease_version IS DISTINCT FROM p_lease OR
    j.lease_expires_at IS NULL OR j.lease_expires_at<=clock_timestamp() OR
    c.provider<>'uniship' OR j.provider<>c.provider OR j.external_account_id<>c.external_account_id OR
    j.sync_type<>'SHIPMENT' OR j.fetch_strategy<>'FULL' OR c.status<>'CONNECTED' OR
    NOT(c.lifecycle_version=j.lifecycle_version OR EXISTS(
      SELECT 1 FROM public.carrier_worker_recoveries r WHERE r.connection_id=c.id AND r.job_id=j.id
       AND r.worker_id=p_worker AND r.lease_version=p_lease AND r.generation=g
       AND r.connection_version=c.lifecycle_version AND r.operation_token=p_operation AND r.expires_at>clock_timestamp()))
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('connection',jsonb_build_object('id',c.id,'provider',c.provider,'externalAccountId',c.external_account_id,
  'loginIdentifier',c.login_identifier,'displayName',c.display_name,'status',c.status,'lastVerifiedAt',c.last_verified_at,'createdAt',c.created_at),
  'generation',g,'version',c.lifecycle_version);
END $$;
CREATE FUNCTION public._sync_carrier_token_context(p_connection uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sealed jsonb;expiry timestamptz;
BEGIN
 SELECT jsonb_build_object('ciphertext',s.ciphertext,'nonce',s.nonce,'authTag',s.auth_tag,'keyVersion',s.key_version),s.expires_at
 INTO sealed,expiry FROM public.carrier_connection_secrets s
 WHERE s.connection_id=p_connection AND s.secret_type='ACCESS_TOKEN';
 RETURN jsonb_build_object('hasToken',sealed IS NOT NULL,'token',sealed,'expiresAt',expiry);
END $$;
CREATE OR REPLACE FUNCTION public.sync_carrier_snapshot(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT ctx || public._sync_carrier_token_context((ctx->'connection'->>'id')::uuid)
 FROM (SELECT public._sync_carrier_context(p_job,p_worker,p_lease,p_operation) AS ctx) authorized $$;
CREATE OR REPLACE FUNCTION public.sync_carrier_claim(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;j public.sync_jobs%ROWTYPE;c uuid;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
 SELECT * INTO j FROM public.sync_jobs WHERE id=p_job;
 IF (ctx->>'version')::integer IS DISTINCT FROM p_version OR p_version IS DISTINCT FROM j.lifecycle_version OR p_version=2147483647
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 c:=(ctx->'connection'->>'id')::uuid;
 UPDATE public.carrier_connections SET lifecycle_version=lifecycle_version+1,updated_at=clock_timestamp() WHERE id=c;
 INSERT INTO public.carrier_worker_recoveries(connection_id,job_id,worker_id,lease_version,generation,connection_version,operation_token,expires_at)
 VALUES(c,p_job,p_worker,p_lease,j.generation,p_version+1,p_operation,j.lease_expires_at)
 ON CONFLICT(connection_id) DO UPDATE SET job_id=excluded.job_id,worker_id=excluded.worker_id,lease_version=excluded.lease_version,
 generation=excluded.generation,connection_version=excluded.connection_version,operation_token=excluded.operation_token,expires_at=excluded.expires_at;
 RETURN public.sync_carrier_snapshot(p_job,p_worker,p_lease,p_operation);
END $$;
CREATE FUNCTION public._sync_carrier_recovery_context(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
 IF (ctx->>'version')::integer IS DISTINCT FROM p_version OR NOT EXISTS(
  SELECT 1 FROM public.carrier_worker_recoveries r
  WHERE r.connection_id=(ctx->'connection'->>'id')::uuid AND r.job_id=p_job
   AND r.worker_id=p_worker AND r.lease_version=p_lease
   AND r.generation=(ctx->>'generation')::integer AND r.connection_version=p_version
   AND r.operation_token=p_operation AND r.expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 RETURN ctx;
END $$;
CREATE FUNCTION public.sync_carrier_load_token(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
 IF (ctx->>'version')::integer IS DISTINCT FROM p_version
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('token',public._sync_carrier_token_context((ctx->'connection'->>'id')::uuid)->'token');
END $$;
CREATE FUNCTION public.sync_carrier_authorize_recovery(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM public._sync_carrier_recovery_context(p_job,p_worker,p_lease,p_operation,p_version);
END $$;
CREATE FUNCTION public.sync_carrier_load_recovery_password(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;password jsonb;
BEGIN
 ctx:=public._sync_carrier_recovery_context(p_job,p_worker,p_lease,p_operation,p_version);
 SELECT jsonb_build_object('ciphertext',s.ciphertext,'nonce',s.nonce,'authTag',s.auth_tag,'keyVersion',s.key_version)
 INTO password FROM public.carrier_connection_secrets s
 WHERE s.connection_id=(ctx->'connection'->>'id')::uuid AND s.secret_type='PASSWORD';
 RETURN jsonb_build_object('loginIdentifier',ctx->'connection'->'loginIdentifier','password',password);
END $$;
DROP FUNCTION public.sync_carrier_load(uuid,uuid,integer,uuid,integer);
REVOKE ALL ON FUNCTION public._sync_carrier_token_context(uuid),
 public._sync_carrier_recovery_context(uuid,uuid,integer,uuid,integer),
 public.sync_carrier_load_token(uuid,uuid,integer,uuid,integer),
 public.sync_carrier_authorize_recovery(uuid,uuid,integer,uuid,integer),
 public.sync_carrier_load_recovery_password(uuid,uuid,integer,uuid,integer) FROM PUBLIC;
COMMIT;
