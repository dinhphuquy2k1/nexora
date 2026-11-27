BEGIN;
CREATE TABLE public.carrier_worker_recoveries (
 connection_id uuid PRIMARY KEY REFERENCES public.carrier_connections(id) ON DELETE CASCADE ON UPDATE CASCADE,
 job_id uuid NOT NULL UNIQUE REFERENCES public.sync_jobs(id) ON DELETE CASCADE ON UPDATE CASCADE,
 worker_id uuid NOT NULL,
 lease_version integer NOT NULL CHECK(lease_version>0),
 generation integer NOT NULL CHECK(generation>=0),
 connection_version integer NOT NULL CHECK(connection_version>0),
 operation_token uuid NOT NULL,
 expires_at timestamptz(3) NOT NULL
);
CREATE TABLE public.uniship_http_budget (
 provider varchar(32) NOT NULL DEFAULT 'uniship' CHECK(provider='uniship'),
 owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 scope_kind varchar(16) NOT NULL CHECK(scope_kind IN ('PENDING','CONNECTION')),
 scope_id uuid NOT NULL,
 connection_id uuid REFERENCES public.carrier_connections(id) ON DELETE CASCADE ON UPDATE CASCADE,
 lease_token uuid,
 lease_expires_at timestamptz(3),
 next_allowed_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 blocked_until timestamptz(3),
 failures integer NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 30),
 PRIMARY KEY(provider,owner_user_id,scope_kind,scope_id),
 CONSTRAINT chk_uniship_http_scope CHECK(
  (scope_kind='PENDING' AND connection_id IS NULL AND scope_id=owner_user_id) OR
  (scope_kind='CONNECTION' AND connection_id IS NOT NULL AND scope_id=connection_id)),
 CONSTRAINT chk_uniship_http_lease CHECK((lease_token IS NULL)=(lease_expires_at IS NULL))
);
-- Authorization/CAS facts only. No network, crypto or business retry policy in SQL.
CREATE FUNCTION public._sync_carrier_context(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.sync_jobs%ROWTYPE;c public.carrier_connections%ROWTYPE;g integer;u varchar;sealed jsonb;expiry timestamptz;
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
 SELECT jsonb_build_object('ciphertext',s.ciphertext,'nonce',s.nonce,'authTag',s.auth_tag,'keyVersion',s.key_version),s.expires_at
 INTO sealed,expiry FROM public.carrier_connection_secrets s WHERE connection_id=c.id AND secret_type='ACCESS_TOKEN';
 RETURN jsonb_build_object('connection',jsonb_build_object('id',c.id,'provider',c.provider,'externalAccountId',c.external_account_id,
  'loginIdentifier',c.login_identifier,'displayName',c.display_name,'status',c.status,'lastVerifiedAt',c.last_verified_at,'createdAt',c.created_at),
  'generation',g,'version',c.lifecycle_version,'hasToken',sealed IS NOT NULL,'token',sealed,'expiresAt',expiry);
END $$;
CREATE FUNCTION public.sync_carrier_snapshot(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT public._sync_carrier_context(p_job,p_worker,p_lease,p_operation) $$;
CREATE FUNCTION public.sync_carrier_claim(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
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
 RETURN public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
END $$;
CREATE FUNCTION public.sync_carrier_load(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;password jsonb;c uuid;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
 IF (ctx->>'version')::integer IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 c:=(ctx->'connection'->>'id')::uuid;
 SELECT jsonb_build_object('ciphertext',s.ciphertext,'nonce',s.nonce,'authTag',s.auth_tag,'keyVersion',s.key_version)
 INTO password FROM public.carrier_connection_secrets s WHERE connection_id=c AND secret_type='PASSWORD';
 RETURN jsonb_build_object('loginIdentifier',ctx->'connection'->'loginIdentifier','password',password,'token',ctx->'token');
END $$;
CREATE FUNCTION public.sync_carrier_complete(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer,
 p_account varchar,p_pc text,p_pn varchar,p_pt varchar,p_pk integer,p_tc text,p_tn varchar,p_tt varchar,p_tk integer,p_expiry timestamptz,p_correlation uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;c uuid;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);c:=(ctx->'connection'->>'id')::uuid;
 IF (ctx->>'version')::integer IS DISTINCT FROM p_version OR p_version=2147483647 OR
    ctx->'connection'->>'externalAccountId' IS DISTINCT FROM p_account OR
    NOT EXISTS(SELECT 1 FROM public.carrier_worker_recoveries r WHERE r.connection_id=c AND r.job_id=p_job AND r.worker_id=p_worker
      AND r.lease_version=p_lease AND r.operation_token=p_operation AND r.connection_version=p_version AND r.expires_at>clock_timestamp()) OR
    p_pc IS NULL OR p_tc IS NULL OR length(p_pc)=0 OR length(p_tc)=0 OR p_pn IS NULL OR p_tn IS NULL OR p_pt IS NULL OR p_tt IS NULL OR
    length(p_pn)>64 OR length(p_tn)>64 OR length(p_pt)>64 OR length(p_tt)>64 OR p_pk IS NULL OR p_tk IS NULL OR p_pk<1 OR p_tk<1 OR p_correlation IS NULL
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.carrier_connection_secrets(id,connection_id,secret_type,ciphertext,nonce,auth_tag,key_version,expires_at,updated_at)
 VALUES(gen_random_uuid(),c,'PASSWORD',p_pc,p_pn,p_pt,p_pk,NULL,clock_timestamp()),(gen_random_uuid(),c,'ACCESS_TOKEN',p_tc,p_tn,p_tt,p_tk,p_expiry,clock_timestamp())
 ON CONFLICT(connection_id,secret_type) DO UPDATE SET ciphertext=excluded.ciphertext,nonce=excluded.nonce,auth_tag=excluded.auth_tag,
 key_version=excluded.key_version,expires_at=excluded.expires_at,updated_at=excluded.updated_at;
 UPDATE public.carrier_connections SET status='CONNECTED',last_verified_at=clock_timestamp(),lifecycle_version=lifecycle_version+1,updated_at=clock_timestamp() WHERE id=c;
 INSERT INTO public.security_audit_events(event_type,outcome,reason,user_id,connection_id,provider,correlation_id)
 SELECT 'RECOVERY','SUCCESS','VERIFIED',owner_user_id,c,'uniship',p_correlation FROM public.sync_jobs WHERE id=p_job;
 DELETE FROM public.carrier_worker_recoveries WHERE connection_id=c AND operation_token=p_operation;
 RETURN ctx->'connection'||jsonb_build_object('status','CONNECTED','lastVerifiedAt',clock_timestamp());
END $$;
CREATE FUNCTION public.sync_carrier_fail(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_version integer,p_status varchar)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;c uuid;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);c:=(ctx->'connection'->>'id')::uuid;
 IF p_status IS NULL OR p_status NOT IN ('ERROR','REAUTH_REQUIRED') OR (ctx->>'version')::integer IS DISTINCT FROM p_version OR p_version=2147483647 OR
    NOT EXISTS(SELECT 1 FROM public.carrier_worker_recoveries WHERE connection_id=c AND operation_token=p_operation AND connection_version=p_version)
 THEN RAISE EXCEPTION 'Scoped carrier authority unavailable' USING ERRCODE='42501';END IF;
 UPDATE public.carrier_connections SET status=p_status,lifecycle_version=lifecycle_version+1,updated_at=clock_timestamp() WHERE id=c;
 DELETE FROM public.carrier_worker_recoveries WHERE connection_id=c AND operation_token=p_operation;
END $$;
-- Rate operations serialize only a compact row; fetch and waiting run after commit.
CREATE FUNCTION public._uniship_http_reserve(p_owner uuid,p_connection uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.uniship_http_budget%ROWTYPE;k varchar;scope uuid;wait_ms integer;
BEGIN
 IF p_owner IS NULL OR p_token IS NULL THEN RAISE EXCEPTION 'Rate authority unavailable' USING ERRCODE='42501';END IF;
 k:=CASE WHEN p_connection IS NULL THEN 'PENDING' ELSE 'CONNECTION' END;scope:=coalesce(p_connection,p_owner);
 INSERT INTO public.uniship_http_budget(owner_user_id,scope_kind,scope_id,connection_id) VALUES(p_owner,k,scope,p_connection) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.uniship_http_budget WHERE provider='uniship' AND owner_user_id=p_owner AND scope_kind=k AND scope_id=scope FOR UPDATE;
 IF r.lease_token=p_token AND r.lease_expires_at>clock_timestamp() THEN RETURN jsonb_build_object('acquired',true,'waitMs',0,'cooldown',false);END IF;
 IF r.blocked_until>clock_timestamp() THEN RETURN jsonb_build_object('acquired',false,'waitMs',least(300000,greatest(1,ceil(extract(epoch FROM r.blocked_until-clock_timestamp())*1000)))::integer,'cooldown',true);END IF;
 IF r.lease_token IS NOT NULL AND r.lease_expires_at>clock_timestamp() THEN
  RETURN jsonb_build_object('acquired',false,'waitMs',100,'cooldown',false);END IF;
 IF r.next_allowed_at>clock_timestamp() THEN
  wait_ms:=greatest(1,ceil(extract(epoch FROM r.next_allowed_at-clock_timestamp())*1000)::integer);
  RETURN jsonb_build_object('acquired',false,'waitMs',wait_ms,'cooldown',false);END IF;
 UPDATE public.uniship_http_budget SET lease_token=p_token,lease_expires_at=clock_timestamp()+interval '15 seconds'
 WHERE provider='uniship' AND owner_user_id=p_owner AND scope_kind=k AND scope_id=scope;
 RETURN jsonb_build_object('acquired',true,'waitMs',0,'cooldown',false);
END $$;
CREATE FUNCTION public._uniship_http_finish(p_owner uuid,p_connection uuid,p_token uuid,p_backoff integer)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.uniship_http_budget%ROWTYPE;k varchar;scope uuid;delay_ms integer;
BEGIN
 IF p_backoff IS NULL OR p_backoff<0 OR p_backoff>300000 THEN RAISE EXCEPTION 'Rate state unavailable' USING ERRCODE='42501';END IF;
 k:=CASE WHEN p_connection IS NULL THEN 'PENDING' ELSE 'CONNECTION' END;scope:=coalesce(p_connection,p_owner);
 SELECT * INTO r FROM public.uniship_http_budget WHERE provider='uniship' AND owner_user_id=p_owner AND scope_kind=k AND scope_id=scope FOR UPDATE;
 IF NOT FOUND OR p_token IS NULL OR r.lease_token IS NULL OR r.lease_expires_at IS NULL OR r.lease_token IS DISTINCT FROM p_token OR r.lease_expires_at<=clock_timestamp() THEN RETURN false;END IF;
 delay_ms:=CASE WHEN p_backoff>0 THEN greatest(p_backoff,least(60000,1000*(2^least(r.failures,6))::integer)) ELSE 0 END;
 UPDATE public.uniship_http_budget SET lease_token=NULL,lease_expires_at=NULL,
 next_allowed_at=greatest(next_allowed_at,clock_timestamp()+interval '1 second'),
 blocked_until=CASE WHEN delay_ms>0 THEN greatest(coalesce(blocked_until,clock_timestamp()),clock_timestamp()+delay_ms*interval '1 millisecond') ELSE blocked_until END,
 failures=CASE WHEN delay_ms>0 THEN least(failures+1,30) ELSE 0 END
 WHERE provider='uniship' AND owner_user_id=p_owner AND scope_kind=k AND scope_id=scope;
 RETURN true;
END $$;
CREATE FUNCTION public.carrier_http_reserve(p_owner uuid,p_connection uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u varchar;
BEGIN
 SELECT status INTO u FROM public.users WHERE id=p_owner FOR SHARE;
 IF u IS DISTINCT FROM 'ACTIVE' THEN RAISE EXCEPTION 'Rate authority unavailable' USING ERRCODE='42501';END IF;
 IF p_connection IS NOT NULL THEN
  PERFORM id FROM public.carrier_connections WHERE id=p_connection AND user_id=p_owner AND provider='uniship' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rate authority unavailable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN public._uniship_http_reserve(p_owner,p_connection,p_token);
END $$;
CREATE FUNCTION public.carrier_http_finish(p_owner uuid,p_connection uuid,p_token uuid,p_backoff integer)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT public._uniship_http_finish(p_owner,p_connection,p_token,p_backoff) $$;
CREATE FUNCTION public.sync_carrier_http_reserve(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;j public.sync_jobs%ROWTYPE;
BEGIN
 ctx:=public._sync_carrier_context(p_job,p_worker,p_lease,p_operation);
 SELECT * INTO j FROM public.sync_jobs WHERE id=p_job;
 RETURN public._uniship_http_reserve(j.owner_user_id,j.carrier_connection_id,p_token);
END $$;
CREATE FUNCTION public.sync_carrier_http_finish(p_job uuid,p_worker uuid,p_lease integer,p_operation uuid,p_token uuid,p_backoff integer)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j public.sync_jobs%ROWTYPE;
BEGIN
 -- Release cannot dispatch/read secrets: the unguessable live permit still fences ownership.
 SELECT * INTO j FROM public.sync_jobs WHERE id=p_job;
 IF j.worker_id IS DISTINCT FROM p_worker OR j.lease_version IS DISTINCT FROM p_lease OR p_operation IS NULL THEN RETURN false;END IF;
 RETURN public._uniship_http_finish(j.owner_user_id,j.carrier_connection_id,p_token,p_backoff);
END $$;
REVOKE ALL ON TABLE public.carrier_worker_recoveries,public.uniship_http_budget FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_carrier_context(uuid,uuid,integer,uuid),public.sync_carrier_snapshot(uuid,uuid,integer,uuid),
 public.sync_carrier_claim(uuid,uuid,integer,uuid,integer),public.sync_carrier_load(uuid,uuid,integer,uuid,integer),
 public.sync_carrier_complete(uuid,uuid,integer,uuid,integer,varchar,text,varchar,varchar,integer,text,varchar,varchar,integer,timestamptz,uuid),
 public.sync_carrier_fail(uuid,uuid,integer,uuid,integer,varchar),public._uniship_http_reserve(uuid,uuid,uuid),
 public._uniship_http_finish(uuid,uuid,uuid,integer),public.carrier_http_reserve(uuid,uuid,uuid),public.carrier_http_finish(uuid,uuid,uuid,integer),
 public.sync_carrier_http_reserve(uuid,uuid,integer,uuid,uuid),public.sync_carrier_http_finish(uuid,uuid,integer,uuid,uuid,integer) FROM PUBLIC;
COMMIT;
