-- Dedicated shared cache for non-personal AI-generated study material.
-- No existing learning_state rows, policies, or sync RPC are changed.

create table if not exists public.ai_learning_content (
  cache_key text primary key check (length(cache_key) between 1 and 320),
  catalog_version text not null check (length(catalog_version) between 1 and 80),
  word_id text not null check (length(word_id) between 1 and 120),
  word_fingerprint text not null check (length(word_fingerprint) = 64),
  content_schema_version integer not null check (content_schema_version > 0),
  prompt_version text not null check (length(prompt_version) between 1 and 80),
  model_name text not null check (length(model_name) between 1 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'reported', 'rejected')),
  payload jsonb,
  lease_token uuid,
  lease_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 1000),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_learning_content_payload_object
    check (payload is null or jsonb_typeof(payload) = 'object'),
  constraint ai_learning_content_ready_payload
    check (status <> 'ready' or payload is not null)
);

create index if not exists ai_learning_content_status_lease_idx
  on public.ai_learning_content (status, lease_until)
  where status = 'pending';

create table if not exists public.ai_generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  minute_window timestamptz not null,
  daily_count integer not null default 0 check (daily_count >= 0),
  minute_count integer not null default 0 check (minute_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index if not exists ai_generation_usage_date_idx
  on public.ai_generation_usage (usage_date);

create table if not exists public.ai_generation_global_usage (
  usage_date date primary key,
  daily_count integer not null default 0 check (daily_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_learning_content enable row level security;
alter table public.ai_generation_usage enable row level security;
alter table public.ai_generation_global_usage enable row level security;

-- The browser has no direct access to these tables. The Edge Function's
-- server-only service_role client is the only intended data-plane caller.
revoke all on table public.ai_learning_content from public, anon, authenticated;
revoke all on table public.ai_generation_usage from public, anon, authenticated;
revoke all on table public.ai_generation_global_usage from public, anon, authenticated;

grant select, insert, update, delete on table public.ai_learning_content to service_role;
grant select, insert, update, delete on table public.ai_generation_usage to service_role;
grant select, insert, update, delete on table public.ai_generation_global_usage to service_role;

create or replace function public.claim_mila_ai_generation(
  p_cache_key text,
  p_catalog_version text,
  p_word_id text,
  p_word_fingerprint text,
  p_content_schema_version integer,
  p_prompt_version text,
  p_model_name text,
  p_user_id uuid,
  p_lease_token uuid,
  p_max_daily integer default 10,
  p_max_per_minute integer default 2,
  p_max_global_daily integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_minute timestamptz := date_trunc('minute', clock_timestamp());
  v_today date := (clock_timestamp() at time zone 'UTC')::date;
  v_content public.ai_learning_content%rowtype;
  v_user_usage public.ai_generation_usage%rowtype;
  v_global_usage public.ai_generation_global_usage%rowtype;
begin
  if p_user_id is null or p_lease_token is null
     or p_cache_key is null or length(p_cache_key) > 320
     or p_word_id is null or length(p_word_id) > 120
     or p_word_fingerprint is null or length(p_word_fingerprint) <> 64
     or p_content_schema_version is null or p_content_schema_version <= 0
     or p_max_daily < 1 or p_max_per_minute < 1 or p_max_global_daily < 1 then
    raise exception 'invalid_generation_claim';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'unknown_user';
  end if;

  insert into public.ai_learning_content (
    cache_key, catalog_version, word_id, word_fingerprint,
    content_schema_version, prompt_version, model_name,
    status, payload, lease_token, lease_until, attempt_count
  )
  values (
    p_cache_key, p_catalog_version, p_word_id, p_word_fingerprint,
    p_content_schema_version, p_prompt_version, p_model_name,
    'pending', null, null, v_now, 0
  )
  on conflict (cache_key) do nothing;

  select * into v_content
  from public.ai_learning_content
  where cache_key = p_cache_key
  for update;

  if v_content.status = 'ready' then
    return jsonb_build_object('status', 'ready', 'payload', v_content.payload, 'model_name', v_content.model_name);
  end if;

  if v_content.status = 'reported' or v_content.status = 'rejected' then
    return jsonb_build_object('status', v_content.status);
  end if;

  if v_content.status = 'pending'
     and v_content.lease_token is not null
     and v_content.lease_until > v_now then
    return jsonb_build_object('status', 'in_progress');
  end if;

  insert into public.ai_generation_global_usage (usage_date, daily_count)
  values (v_today, 0)
  on conflict (usage_date) do nothing;

  select * into v_global_usage
  from public.ai_generation_global_usage
  where usage_date = v_today
  for update;

  if v_global_usage.daily_count >= p_max_global_daily then
    return jsonb_build_object('status', 'global_limit');
  end if;

  insert into public.ai_generation_usage (
    user_id, usage_date, minute_window, daily_count, minute_count
  )
  values (p_user_id, v_today, v_minute, 0, 0)
  on conflict (user_id, usage_date) do nothing;

  select * into v_user_usage
  from public.ai_generation_usage
  where user_id = p_user_id and usage_date = v_today
  for update;

  if v_user_usage.daily_count >= p_max_daily then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  if v_user_usage.minute_window = v_minute
     and v_user_usage.minute_count >= p_max_per_minute then
    return jsonb_build_object('status', 'user_rate_limit');
  end if;

  update public.ai_generation_global_usage
  set daily_count = daily_count + 1, updated_at = v_now
  where usage_date = v_today;

  update public.ai_generation_usage
  set daily_count = daily_count + 1,
      minute_count = case when minute_window = v_minute then minute_count + 1 else 1 end,
      minute_window = v_minute,
      updated_at = v_now
  where user_id = p_user_id and usage_date = v_today;

  update public.ai_learning_content
  set catalog_version = p_catalog_version,
      word_id = p_word_id,
      word_fingerprint = p_word_fingerprint,
      content_schema_version = p_content_schema_version,
      prompt_version = p_prompt_version,
      model_name = p_model_name,
      status = 'pending',
      payload = null,
      lease_token = p_lease_token,
      lease_until = v_now + interval '90 seconds',
      attempt_count = attempt_count + 1,
      updated_at = v_now
  where cache_key = p_cache_key;

  return jsonb_build_object('status', 'claimed', 'lease_token', p_lease_token);
end;
$function$;

revoke all on function public.claim_mila_ai_generation(
  text, text, text, text, integer, text, text, uuid, uuid, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_mila_ai_generation(
  text, text, text, text, integer, text, text, uuid, uuid, integer, integer, integer
) to service_role;

comment on table public.ai_learning_content is
  'Shared, non-user-specific and schema-validated AI learning content. Client roles have no direct access.';
comment on table public.ai_generation_usage is
  'Minimal per-user generation counters only; stores no prompts, answers, vocabulary history or personal text.';
comment on table public.ai_generation_global_usage is
  'Project-wide daily generation ceiling for abuse and free-tier quota protection.';
