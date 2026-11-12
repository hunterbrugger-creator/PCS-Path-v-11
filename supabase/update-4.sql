-- =====================================================================
-- PCS Path update 4: "not moving" accounts, Squadron CSS role,
-- and offices confirming appointment requests.
--
-- Run once in Supabase, after appointments.sql:
--   SQL Editor -> New query (SQL tab, not Logs) -> paste -> Run
-- =====================================================================

-- 1. People who are not moving (staff, sponsors) can sign up with dir = 'none'.
alter table public.profiles drop constraint if exists profiles_dir_check;
alter table public.profiles add constraint profiles_dir_check check (dir in ('out','in','both','none'));

-- 2. Squadron CSS counts as staff, so it can see members at its base.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_roles() && array['worker','lead','counsel','css','mpf','cmd','global']
$$;

-- 3. Profile guard, updated: a Squadron CSS may assign sponsors and switch
--    the Sponsor role on or off for other people. Nothing else changes.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare keep_handoff text; keep_sponsor uuid; want_roles text[];
begin
  if auth.uid() is null or public.has_role('global') then
    return new;
  end if;

  if public.has_role('mpf') then
    if (('mpf' = any(new.roles)) is distinct from ('mpf' = any(old.roles)))
       or (('global' = any(new.roles)) is distinct from ('global' = any(old.roles))) then
      raise exception 'Only a global admin can grant or remove MPF or global admin rights';
    end if;
    return new;
  end if;

  if old.id <> auth.uid() then
    keep_handoff := new.handoff;
    keep_sponsor := new.sponsor_id;
    want_roles   := new.roles;
    new := old;
    new.handoff := keep_handoff;
    if public.has_role('css') then
      new.sponsor_id := keep_sponsor;
      -- only the Sponsor role may be added or removed
      if array_remove(want_roles, 'sponsor') @> array_remove(old.roles, 'sponsor')
         and array_remove(old.roles, 'sponsor') @> array_remove(want_roles, 'sponsor') then
        new.roles := want_roles;
      end if;
    end if;
    return new;
  end if;

  -- Editing your own profile.
  new.roles      := old.roles;
  new.base_id    := old.base_id;
  new.handoff    := old.handoff;
  new.sponsor_id := old.sponsor_id;
  new.office_id  := old.office_id;
  if not (old.status = 'returned' and new.status = 'pending') then
    new.status := old.status;
  end if;
  return new;
end $$;

-- 4. When a member asks for an appointment, tell the office's workers and
--    leads. If nobody is linked to that office yet, tell the base MPF.
create or replace function public.notify_office_of_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o      record;
  who    text;
  tname  text;
  sl     record;
  whenx  text := '';
  n      int := 0;
begin
  if new.status <> 'pending' then return new; end if;
  select * into o from offices where id = new.office_id;
  if not found then return new; end if;
  select name into who from profiles where id = new.member_id;
  select name into tname from tasks where id = new.task_id;
  if new.slot_id is not null then
    select * into sl from slots where id = new.slot_id;
    if found then whenx := ', ' || to_char(sl.slot_day, 'Dy DD Mon') || ' ' || replace(sl.slot_time, ':', ''); end if;
  end if;

  insert into notifications (user_id, kind, title, body)
  select p.id, 'appt', 'Appointment request: ' || coalesce(who, 'a member'),
         coalesce(tname, 'A task') || whenx || '. Confirm or reject it under Appts.'
  from profiles p
  where p.office_id = o.id and p.status = 'active' and p.roles && array['worker','lead'];
  get diagnostics n = row_count;

  if n = 0 then
    insert into notifications (user_id, kind, title, body)
    select p.id, 'appt', 'Appointment request: ' || coalesce(who, 'a member'),
           coalesce(tname, 'A task') || whenx || ' at ' || o.name || '. Nobody is linked to that office, so confirm or reject it under Appts.'
    from profiles p
    where p.base_id = o.base_id and p.status = 'active' and 'mpf' = any(p.roles);
  end if;
  return new;
end $$;

drop trigger if exists appt_request_notify on public.appt_requests;
create trigger appt_request_notify
  after insert on public.appt_requests
  for each row execute function public.notify_office_of_request();

-- 5. Help and feedback. Anyone can send a message, even when signed out
--    (for example after forgetting a password). Global admins read and answer them.
create table public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  email            text,
  name             text,
  base_id          text,
  kind             text not null default 'other',
  message          text not null check (char_length(message) between 1 and 4000),
  context          text,
  attachment_path  text,
  attachment_name  text,
  status           text not null default 'new' check (status in ('new','open','resolved')),
  reply            text,
  replied_at       timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.support_tickets enable row level security;

create policy "anyone can ask for help" on public.support_tickets for insert to anon, authenticated
  with check ((user_id is null or user_id = auth.uid()) and status = 'new' and reply is null);
create policy "see own messages" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.has_role('global'));
create policy "global admins answer" on public.support_tickets for update to authenticated
  using (public.has_role('global')) with check (public.has_role('global'));

-- Tell every global admin when a new message arrives.
create or replace function public.notify_support() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, title, body)
  select p.id, 'system', 'New help request from ' || coalesce(new.name, new.email, 'someone'), left(new.message, 160)
  from profiles p
  where 'global' = any(p.roles) and p.status = 'active';
  return new;
end $$;

drop trigger if exists support_notify on public.support_tickets;
create trigger support_notify
  after insert on public.support_tickets
  for each row execute function public.notify_support();
