-- =====================================================================
-- PCS Path database schema for Supabase (Postgres)
--
-- Run this whole file once in the Supabase dashboard:
--   SQL Editor  ->  New query  ->  paste  ->  Run
-- It creates the tables, the security rules (row level security) that
-- decide who can see and change what, and the starter list of bases.
-- It is safe to run on a brand new project. Do not run it twice.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.bases (
  id       text primary key,              -- short slug, e.g. 'mildenhall'
  name     text not null,
  country  text,
  live     boolean not null default false -- false = base not onboarded yet
);

create table public.offices (
  id        uuid primary key default gen_random_uuid(),
  base_id   text not null references public.bases(id) on delete cascade,
  name      text not null,
  building  text,
  phone     text,
  hours     text,
  status    text not null default 'Open'
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  name          text not null,
  unit          text,
  base_id       text references public.bases(id),
  roles         text[] not null default array['member'],
  status        text not null default 'pending' check (status in ('pending','active','returned')),
  office_id     uuid references public.offices(id) on delete set null,
  dir           text not null default 'out' check (dir in ('out','in','both')),
  gaining_base  text references public.bases(id),
  depart        date,
  rnltd         date,
  move_type     text,
  flags         jsonb not null default '{}'::jsonb,
  docs          jsonb not null default '{}'::jsonb,
  sponsor_id    uuid references public.profiles(id) on delete set null,
  handoff       text not null default 'pending' check (handoff in ('pending','complete')),
  return_note   text,
  created_at    timestamptz not null default now()
);

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  base_id           text not null references public.bases(id) on delete cascade,
  dir               text not null check (dir in ('out','in')),
  name              text not null,
  descr             text,
  office_name       text,
  loc               text,
  hours             text,
  phone             text,
  office_id         uuid references public.offices(id) on delete set null, -- office that signs it off
  offset_days       int not null default 0,  -- out: days before departure; in: days after RNLTD
  tag               text,                    -- only shown when the member's flag of this name is on
  carry             boolean not null default false,
  triggers_handoff  boolean not null default false,
  sort              int not null default 0
);

create table public.task_progress (
  member_id    uuid not null references public.profiles(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  status       text not null check (status in ('submitted','done','na')),
  signed_by    uuid references public.profiles(id) on delete set null,
  signed_name  text,
  updated_at   timestamptz not null default now(),
  primary key (member_id, task_id)
);

create table public.tips (
  id          uuid primary key default gen_random_uuid(),
  base_id     text references public.bases(id) on delete cascade, -- null = Air Force wide
  tier        text not null,      -- global, mpf, office, counsel, cmd
  label       text,
  title       text not null,
  body        text,
  applies     text not null default 'both' check (applies in ('out','in','both')),
  author_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade, -- the thread is member <-> their sponsor
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'reminder',
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  dedupe_key  text,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table public.slots (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null references public.offices(id) on delete cascade,
  slot_day   date not null,
  slot_time  text not null,
  member_id  uuid references public.profiles(id) on delete set null,
  blocked    boolean not null default false
);

create table public.appt_requests (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete cascade,
  office_id   uuid references public.offices(id) on delete cascade,
  note        text,
  status      text not null default 'pending' check (status in ('pending','confirmed','declined')),
  slot_id     uuid references public.slots(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.role_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text,
  base_id        text references public.bases(id) on delete cascade,
  current_roles  text,
  wanted_role    text not null,
  reason         text,
  status         text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at     timestamptz not null default now()
);

create table public.reminder_rules (
  id        uuid primary key default gen_random_uuid(),
  base_id   text not null references public.bases(id) on delete cascade,
  rule_key  text not null,
  title     text,
  body      text,
  enabled   boolean not null default true,
  unique (base_id, rule_key)
);

create table public.sponsor_prep (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on public.task_progress (task_id);
create index on public.tasks (base_id, dir);
create index on public.profiles (base_id);
create index on public.profiles (gaining_base);
create index on public.messages (member_id);
create index on public.notifications (user_id);

-- ---------------------------------------------------------------------
-- Helper functions used by the security rules.
-- "security definer" lets them read profiles without tripping the
-- profiles table's own rules (which would loop forever).
-- ---------------------------------------------------------------------

create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select roles from profiles where id = auth.uid() and status = 'active'), array[]::text[])
$$;

create or replace function public.has_role(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select r = any(public.my_roles())
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_roles() && array['worker','lead','counsel','mpf','cmd','global']
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_roles() && array['mpf','global']
$$;

create or replace function public.my_base() returns text
language sql stable security definer set search_path = public as $$
  select base_id from profiles where id = auth.uid()
$$;

create or replace function public.my_office() returns uuid
language sql stable security definer set search_path = public as $$
  select office_id from profiles where id = auth.uid()
$$;

create or replace function public.sponsor_of(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select sponsor_id from profiles where id = m
$$;

-- Staff can see members of their own base, and members inbound to it.
create or replace function public.staff_can_see(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and (
    public.has_role('global') or exists (
      select 1 from profiles p
      where p.id = m and (p.base_id = public.my_base() or p.gaining_base = public.my_base())
    )
  )
$$;

-- ---------------------------------------------------------------------
-- New sign-ups: create their profile from the sign-up form, as pending.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, name, unit, base_id, dir, gaining_base, depart, rnltd, move_type, flags)
  values (
    new.id, new.email,
    coalesce(nullif(m->>'name',''), new.email),
    nullif(m->>'unit',''),
    nullif(m->>'base_id',''),
    coalesce(nullif(m->>'dir',''), 'out'),
    nullif(m->>'gaining_base',''),
    nullif(m->>'depart','')::date,
    nullif(m->>'rnltd','')::date,
    nullif(m->>'move_type',''),
    coalesce(m->'flags', '{}'::jsonb)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profile guard: members cannot approve themselves or give themselves
-- roles. Office staff may only flip the handoff flag on someone else.
-- Only a global admin can grant or remove MPF / global admin rights.
-- ---------------------------------------------------------------------

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare keep_handoff text;
begin
  -- SQL editor / service role (no signed-in user): allow anything.
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
    new := old;
    new.handoff := keep_handoff;
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

create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------

alter table public.bases          enable row level security;
alter table public.offices        enable row level security;
alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_progress  enable row level security;
alter table public.tips           enable row level security;
alter table public.messages       enable row level security;
alter table public.notifications  enable row level security;
alter table public.slots          enable row level security;
alter table public.appt_requests  enable row level security;
alter table public.role_requests  enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.sponsor_prep   enable row level security;

-- bases: anyone (even signed out, for the sign-up form) can read.
create policy "bases are public" on public.bases for select using (true);
create policy "global admins manage bases" on public.bases for all to authenticated
  using (public.has_role('global')) with check (public.has_role('global'));

-- offices
create policy "offices readable" on public.offices for select to authenticated using (true);
create policy "admins manage offices" on public.offices for all to authenticated
  using (public.is_admin() and (base_id = public.my_base() or public.has_role('global')))
  with check (public.is_admin() and (base_id = public.my_base() or public.has_role('global')));
create policy "leads update their office" on public.offices for update to authenticated
  using (public.has_role('lead') and id = public.my_office())
  with check (public.has_role('lead') and id = public.my_office());

-- profiles
create policy "see own, sponsor links, and base members" on public.profiles for select to authenticated
  using (id = auth.uid() or sponsor_id = auth.uid() or id = public.sponsor_of(auth.uid()) or public.staff_can_see(id));
create policy "update own, or as staff" on public.profiles for update to authenticated
  using (id = auth.uid() or public.staff_can_see(id))
  with check (id = auth.uid() or public.staff_can_see(id));

-- tasks (the master lists)
create policy "tasks readable" on public.tasks for select to authenticated using (true);
create policy "admins manage tasks" on public.tasks for all to authenticated
  using (public.is_admin() and (base_id = public.my_base() or public.has_role('global')))
  with check (public.is_admin() and (base_id = public.my_base() or public.has_role('global')));

-- task_progress (sign-offs)
create policy "progress visible" on public.task_progress for select to authenticated
  using (member_id = auth.uid() or public.sponsor_of(member_id) = auth.uid() or public.staff_can_see(member_id));
create policy "staff sign off others" on public.task_progress for all to authenticated
  using (member_id <> auth.uid() and public.staff_can_see(member_id))
  with check (member_id <> auth.uid() and public.staff_can_see(member_id));
create policy "members mark their part" on public.task_progress for insert to authenticated
  with check (member_id = auth.uid() and status = 'submitted');
create policy "members edit own submitted" on public.task_progress for update to authenticated
  using (member_id = auth.uid() and status = 'submitted')
  with check (member_id = auth.uid() and status = 'submitted');
create policy "members undo own submitted" on public.task_progress for delete to authenticated
  using (member_id = auth.uid() and status = 'submitted');

-- tips
create policy "tips readable" on public.tips for select to authenticated using (true);
create policy "staff add tips" on public.tips for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid()
              and (base_id = public.my_base() or (base_id is null and public.has_role('global'))));
create policy "authors and admins remove tips" on public.tips for delete to authenticated
  using (author_id = auth.uid() or public.has_role('global')
         or (public.has_role('mpf') and base_id = public.my_base()));

-- messages (member <-> sponsor)
create policy "thread participants read" on public.messages for select to authenticated
  using (member_id = auth.uid() or public.sponsor_of(member_id) = auth.uid());
create policy "thread participants write" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (member_id = auth.uid() or public.sponsor_of(member_id) = auth.uid()));

-- notifications
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy "send notifications" on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or public.is_staff()
              or user_id = public.sponsor_of(auth.uid()) or public.sponsor_of(user_id) = auth.uid());

-- slots (office appointment times)
create policy "slots readable" on public.slots for select to authenticated using (true);
create policy "office staff manage slots" on public.slots for all to authenticated
  using (((public.has_role('lead') or public.has_role('worker')) and office_id = public.my_office())
         or (public.is_admin() and exists (select 1 from public.offices o where o.id = office_id
             and (o.base_id = public.my_base() or public.has_role('global')))))
  with check (((public.has_role('lead') or public.has_role('worker')) and office_id = public.my_office())
         or (public.is_admin() and exists (select 1 from public.offices o where o.id = office_id
             and (o.base_id = public.my_base() or public.has_role('global')))));

-- appointment requests
create policy "appt visible" on public.appt_requests for select to authenticated
  using (member_id = auth.uid() or public.staff_can_see(member_id));
create policy "members request" on public.appt_requests for insert to authenticated
  with check (member_id = auth.uid());
create policy "staff answer" on public.appt_requests for update to authenticated
  using (public.staff_can_see(member_id)) with check (public.staff_can_see(member_id));
create policy "members withdraw" on public.appt_requests for delete to authenticated
  using (member_id = auth.uid() and status = 'pending');

-- role requests
create policy "role requests visible" on public.role_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role('global')
         or (public.has_role('mpf') and base_id = public.my_base()));
create policy "ask for a role" on public.role_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "admins decide" on public.role_requests for update to authenticated
  using (public.has_role('global') or (public.has_role('mpf') and base_id = public.my_base()))
  with check (public.has_role('global') or (public.has_role('mpf') and base_id = public.my_base()));

-- reminder rules
create policy "rules readable" on public.reminder_rules for select to authenticated using (true);
create policy "admins manage rules" on public.reminder_rules for all to authenticated
  using (public.is_admin() and (base_id = public.my_base() or public.has_role('global')))
  with check (public.is_admin() and (base_id = public.my_base() or public.has_role('global')));

-- sponsor prep list
create policy "prep visible" on public.sponsor_prep for select to authenticated
  using (member_id = auth.uid() or public.sponsor_of(member_id) = auth.uid() or public.staff_can_see(member_id));
create policy "sponsor manages prep" on public.sponsor_prep for all to authenticated
  using (public.sponsor_of(member_id) = auth.uid())
  with check (public.sponsor_of(member_id) = auth.uid());

-- ---------------------------------------------------------------------
-- Starter bases. Add more any time from the Global admin > Bases tab.
-- ---------------------------------------------------------------------

insert into public.bases (id, name, country, live) values
  ('mildenhall', 'RAF Mildenhall', 'UK', true),
  ('lakenheath', 'RAF Lakenheath', 'UK', false),
  ('ramstein',   'Ramstein AB',    'Germany', false),
  ('spangdahlem','Spangdahlem AB', 'Germany', false),
  ('aviano',     'Aviano AB',      'Italy', false),
  ('kadena',     'Kadena AB',      'Japan', false),
  ('yokota',     'Yokota AB',      'Japan', false),
  ('misawa',     'Misawa AB',      'Japan', false),
  ('osan',       'Osan AB',        'South Korea', false),
  ('kunsan',     'Kunsan AB',      'South Korea', false),
  ('travis',     'Travis AFB',     'CONUS', false),
  ('dover',      'Dover AFB',      'CONUS', false),
  ('mcguire',    'JB McGuire-Dix-Lakehurst', 'CONUS', false),
  ('scott',      'Scott AFB',      'CONUS', false),
  ('lackland',   'JBSA-Lackland',  'CONUS', false);

-- ---------------------------------------------------------------------
-- AFTER you sign up in the app with your own email, make yourself the
-- first admin by running this (with your email) in a new query:
--
--   update public.profiles
--   set roles = array['global','mpf','member'], status = 'active'
--   where email = 'your.email@example.com';
-- ---------------------------------------------------------------------
