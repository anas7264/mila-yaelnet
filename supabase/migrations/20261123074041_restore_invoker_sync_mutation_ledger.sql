-- Keep the RPC as SECURITY INVOKER. Give it narrowly scoped, RLS-checked
-- access to its private idempotency ledger instead of bypassing RLS.
alter function public.sync_learning_state(jsonb, bigint, uuid, uuid, integer)
  security invoker;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on table private.learning_mutations from public, anon, authenticated;
grant select, insert on table private.learning_mutations to authenticated;

drop policy if exists "Users can read their own sync mutations" on private.learning_mutations;
create policy "Users can read their own sync mutations"
  on private.learning_mutations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own sync mutations" on private.learning_mutations;
create policy "Users can insert their own sync mutations"
  on private.learning_mutations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.learning_state to authenticated;

drop policy if exists "Users can insert their own learning state" on public.learning_state;
create policy "Users can insert their own learning state"
  on public.learning_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own learning state" on public.learning_state;
create policy "Users can update their own learning state"
  on public.learning_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
