-- =====================================================================
-- PCS Path update 5: squadron checklists
--
-- Run once in Supabase, after update-4.sql:
--   SQL Editor -> New query (SQL tab, not Logs) -> paste -> Run
--
-- A task with a unit (for example '100 LRS') is shown only to members of
-- that unit: their current unit for out-processing, and their gaining unit
-- for in-processing. Each squadron's CSS maintains its own tasks.
-- =====================================================================

alter table public.tasks    add column if not exists unit text;
alter table public.profiles add column if not exists gaining_unit text;

create or replace function public.my_unit() returns text
language sql stable security definer set search_path = public as $$
  select unit from profiles where id = auth.uid()
$$;

-- Units are compared ignoring spaces and capitals, so '100 LRS' matches '100lrs'.
create or replace function public.unit_key(u text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(u, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- A Squadron CSS may add, change and remove tasks for their own unit at their base.
drop policy if exists "squadron CSS manages squadron tasks" on public.tasks;
create policy "squadron CSS manages squadron tasks" on public.tasks for all to authenticated
  using (public.has_role('css') and base_id = public.my_base() and unit is not null
         and public.unit_key(unit) = public.unit_key(public.my_unit()))
  with check (public.has_role('css') and base_id = public.my_base() and unit is not null
              and public.unit_key(unit) = public.unit_key(public.my_unit()));

-- New sign-ups can give their gaining unit.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, name, unit, base_id, dir, gaining_base, gaining_unit, depart, rnltd, move_type, flags)
  values (
    new.id, new.email,
    coalesce(nullif(m->>'name',''), new.email),
    nullif(m->>'unit',''),
    nullif(m->>'base_id',''),
    coalesce(nullif(m->>'dir',''), 'out'),
    nullif(m->>'gaining_base',''),
    nullif(m->>'gaining_unit',''),
    nullif(m->>'depart','')::date,
    nullif(m->>'rnltd','')::date,
    nullif(m->>'move_type',''),
    coalesce(m->'flags', '{}'::jsonb)
  );
  return new;
end $$;

-- A Squadron CSS is tied to one squadron: the unit on their own profile.
-- A person whose only staff role is Squadron CSS can see and act on members
-- of that squadron only (members leaving it, and members arriving with it as
-- their gaining unit). Other staff roles keep base-wide access.
create or replace function public.staff_can_see(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    (public.my_roles() && array['worker','lead','counsel','mpf','cmd','global'] and (
      public.has_role('global') or exists (
        select 1 from profiles p
        where p.id = m and (p.base_id = public.my_base() or p.gaining_base = public.my_base())
      )
    ))
    or
    (public.has_role('css') and public.unit_key(public.my_unit()) <> '' and exists (
      select 1 from profiles p
      where p.id = m and (
        (p.base_id = public.my_base() and public.unit_key(p.unit) = public.unit_key(public.my_unit()))
        or (p.gaining_base = public.my_base() and public.unit_key(p.gaining_unit) = public.unit_key(public.my_unit()))
      )
    ))
$$;
