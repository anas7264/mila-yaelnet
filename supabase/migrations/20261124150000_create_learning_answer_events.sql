create table if not exists public.learning_answer_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 180),
  session_id text not null check (char_length(session_id) between 1 and 120),
  occurred_at timestamptz not null,
  event_type text not null check (char_length(event_type) between 1 and 40),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_answer_events_user_event_unique unique (user_id, event_id)
);

create index if not exists learning_answer_events_user_session_time_idx
  on public.learning_answer_events (user_id, session_id, occurred_at desc);

create index if not exists learning_answer_events_user_word_time_idx
  on public.learning_answer_events (user_id, (payload ->> 'wordId'), occurred_at desc);

alter table public.learning_answer_events enable row level security;

drop policy if exists "Users can insert their own learning answer events" on public.learning_answer_events;
create policy "Users can insert their own learning answer events"
  on public.learning_answer_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own learning answer events" on public.learning_answer_events;
create policy "Users can read their own learning answer events"
  on public.learning_answer_events for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.learning_answer_events from anon, authenticated;
grant select, insert on table public.learning_answer_events to authenticated;
revoke all on sequence public.learning_answer_events_id_seq from anon, authenticated;
grant usage, select on sequence public.learning_answer_events_id_seq to authenticated;

comment on table public.learning_answer_events is
  'Append-only per-answer learning history. Client inserts and reads only its own rows; updates and deletes are intentionally not granted.';
