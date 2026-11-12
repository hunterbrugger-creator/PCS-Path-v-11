-- =====================================================================
-- PCS Path: forms and file uploads
--
-- Run this once, AFTER schema.sql, in Supabase:
--   SQL Editor -> New query (SQL tab, not Logs) -> paste -> Run
--
-- It creates two file stores:
--   forms   - blank forms attached to tasks by the MPF or office leads.
--             Anyone with the link can open these, so never put personal
--             information in them.
--   uploads - files members attach to their own tasks. Private: only the
--             member and staff at their losing or gaining base can open them.
-- =====================================================================

-- Blank forms attached to master-list tasks
create table public.task_files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  name         text not null,
  path         text not null,
  size         int,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Files a member uploads for one of their tasks
create table public.member_files (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete cascade,
  name        text not null,
  path        text not null,
  size        int,
  created_at  timestamptz not null default now()
);

create index on public.task_files (task_id);
create index on public.member_files (member_id);

alter table public.task_files   enable row level security;
alter table public.member_files enable row level security;

-- Can the signed-in user manage forms on this task? (MPF or office lead at its base)
create or replace function public.can_manage_task(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.is_admin() or public.has_role('lead')) and exists (
    select 1 from tasks where id = t and (base_id = public.my_base() or public.has_role('global'))
  )
$$;

create policy "forms list readable" on public.task_files for select to authenticated using (true);
create policy "admins and leads add forms" on public.task_files for insert to authenticated
  with check (public.can_manage_task(task_id));
create policy "admins and leads remove forms" on public.task_files for delete to authenticated
  using (public.can_manage_task(task_id));

create policy "own and staff see uploads" on public.member_files for select to authenticated
  using (member_id = auth.uid() or public.staff_can_see(member_id));
create policy "members add own uploads" on public.member_files for insert to authenticated
  with check (member_id = auth.uid());
create policy "members remove own uploads" on public.member_files for delete to authenticated
  using (member_id = auth.uid());

-- ---------------------------------------------------------------------
-- File storage buckets (10 MB limit; PDF, images and Word files)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('forms', 'forms', true, 10485760, array['application/pdf','image/png','image/jpeg','image/heic','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('uploads', 'uploads', false, 10485760, array['application/pdf','image/png','image/jpeg','image/heic','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- Upload paths start with the member's id: <member id>/<task id>/<file>
create or replace function public.path_owner(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy "admins and leads upload forms" on storage.objects for insert to authenticated
  with check (bucket_id = 'forms' and (public.is_admin() or public.has_role('lead')));
create policy "admins and leads delete forms" on storage.objects for delete to authenticated
  using (bucket_id = 'forms' and (public.is_admin() or public.has_role('lead')));

create policy "members upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.path_owner(name) = auth.uid());
create policy "own and staff open uploads" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (public.path_owner(name) = auth.uid() or public.staff_can_see(public.path_owner(name))));
create policy "members delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.path_owner(name) = auth.uid());
