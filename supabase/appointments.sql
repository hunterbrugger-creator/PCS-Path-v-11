-- =====================================================================
-- PCS Path: self-service appointments
--
-- Run this once in Supabase, after schema.sql:
--   SQL Editor -> New query (SQL tab, not Logs) -> paste -> Run
--
-- Every office takes bookings Monday to Friday, 0800-1600, in 30-minute
-- slots, unless its lead changes the hours. Members book a free time
-- themselves and it is confirmed straight away. Only booked or blocked
-- times are stored.
-- =====================================================================

-- Weekly appointment hours for each office. open_days uses 0 = Sunday ... 6 = Saturday.
alter table public.offices
  add column if not exists open_days    text not null default '12345',
  add column if not exists open_time    text not null default '08:00',
  add column if not exists close_time   text not null default '16:00',
  add column if not exists slot_minutes int  not null default 30;

-- Old-style empty slots are no longer needed.
delete from public.slots where member_id is null and blocked = false;

-- One booking per office per time, so two people can't grab the same slot.
create unique index if not exists slots_one_per_time on public.slots (office_id, slot_day, slot_time);

-- Members can book a free time for themselves, and cancel their own booking.
create policy "members book a time" on public.slots for insert to authenticated
  with check (member_id = auth.uid() and blocked = false);
create policy "members cancel own booking" on public.slots for delete to authenticated
  using (member_id = auth.uid());

-- Members can cancel their own appointment, booked or still pending.
drop policy if exists "members withdraw" on public.appt_requests;
create policy "members cancel own appointment" on public.appt_requests for delete to authenticated
  using (member_id = auth.uid());
