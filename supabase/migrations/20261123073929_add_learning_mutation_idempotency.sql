create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.learning_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  revision bigint not null check (revision > 0),
  device_id uuid,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, mutation_id)
);

alter table private.learning_mutations enable row level security;
revoke all on table private.learning_mutations from public, anon, authenticated;
comment on table private.learning_mutations is
  'Private idempotency ledger for sync_learning_state. One row per accepted mutation ID and user.';

create or replace function public.sync_learning_state(
  p_state jsonb,
  p_expected_revision bigint,
  p_mutation_id uuid,
  p_device_id uuid,
  p_schema_version integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.learning_state%rowtype;
  v_payload_hash text;
  v_existing_hash text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_state is null or pg_catalog.jsonb_typeof(p_state) <> 'object' then
    raise exception 'Learning state must be a JSON object' using errcode = '22023';
  end if;
  if pg_catalog.octet_length(p_state::text) > 2097152 then
    raise exception 'Learning state exceeds the 2 MiB limit' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected revision must be a non-negative integer' using errcode = '22023';
  end if;
  if p_mutation_id is null then
    raise exception 'Mutation ID is required' using errcode = '22023';
  end if;
  if p_schema_version is null or p_schema_version < 1 then
    raise exception 'Schema version must be a positive integer' using errcode = '22023';
  end if;

  v_payload_hash := pg_catalog.md5(p_state::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  insert into public.learning_state (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_row
    from public.learning_state
   where user_id = v_user_id
   for update;

  select payload_hash into v_existing_hash
    from private.learning_mutations
   where user_id = v_user_id
     and mutation_id = p_mutation_id;

  if found then
    if v_existing_hash <> v_payload_hash then
      raise exception 'Mutation ID was reused with a different payload'
        using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'status', 'duplicate',
      'revision', v_row.revision,
      'state', v_row.state,
      'updated_at', v_row.updated_at
    );
  end if;

  if v_row.revision <> p_expected_revision then
    return pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'revision', v_row.revision,
      'state', v_row.state,
      'updated_at', v_row.updated_at
    );
  end if;

  update public.learning_state
     set state = p_state,
         schema_version = p_schema_version,
         revision = v_row.revision + 1,
         updated_at = pg_catalog.now(),
         updated_by_device_id = p_device_id,
         last_mutation_id = p_mutation_id
   where user_id = v_user_id
   returning * into v_row;

  insert into private.learning_mutations (
    user_id, mutation_id, revision, device_id, payload_hash
  ) values (
    v_user_id, p_mutation_id, v_row.revision, p_device_id, v_payload_hash
  );

  return pg_catalog.jsonb_build_object(
    'status', 'saved',
    'revision', v_row.revision,
    'state', v_row.state,
    'updated_at', v_row.updated_at
  );
end;
$function$;

alter function public.sync_learning_state(jsonb, bigint, uuid, uuid, integer)
  owner to postgres;
revoke all on function public.sync_learning_state(jsonb, bigint, uuid, uuid, integer)
  from public, anon;
grant execute on function public.sync_learning_state(jsonb, bigint, uuid, uuid, integer)
  to authenticated;

drop policy if exists "Users can insert their own learning state" on public.learning_state;
drop policy if exists "Users can update their own learning state" on public.learning_state;
revoke insert, update, delete on public.learning_state from anon, authenticated;
grant select on public.learning_state to authenticated;
