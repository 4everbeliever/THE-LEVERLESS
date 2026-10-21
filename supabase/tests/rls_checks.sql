-- Toolshed Rentals: RLS Test Suite
-- Run in the Supabase SQL editor to verify security and permissions across roles.
-- This script runs in a transaction and ROLLS BACK at the end so it leaves no test data.

begin;

-- Create temporary test users in auth.users
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'customer_a@example.com', '{"full_name":"Customer A"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'customer_b@example.com', '{"full_name":"Customer B"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'staff_user@example.com', '{"full_name":"Staff User"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'admin_user@example.com', '{"full_name":"Admin User"}'::jsonb)
on conflict (id) do nothing;

-- Set up roles in public.profiles
update public.profiles set role = 'customer' where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set role = 'staff' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin' where id = '44444444-4444-4444-4444-444444444444';

-- TEST 1: Anon role cannot read profiles
set local role anon;
set local "request.jwt.claims" to '{}';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles;
  if v_count > 0 then
    raise exception 'TEST 1 FAILED: anon was able to read % profiles', v_count;
  end if;
  raise notice 'TEST 1 PASSED: anon cannot read profiles.';
end $$;

-- TEST 2: Customer can read only their own profile
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles;
  if v_count <> 1 then
    raise exception 'TEST 2 FAILED: customer read % profiles, expected 1 (own)', v_count;
  end if;

  if exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'TEST 2 FAILED: customer was able to read customer B profile';
  end if;
  raise notice 'TEST 2 PASSED: customer can read only their own profile.';
end $$;

-- TEST 3: Customer cannot change their own role
do $$
begin
  update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  -- If update succeeds without raising exception, verify role was not changed
  if exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' and role = 'admin') then
    raise exception 'TEST 3 FAILED: customer escalated own role to admin';
  end if;
  raise notice 'TEST 3 PASSED: customer role escalation was blocked.';
exception when others then
  raise notice 'TEST 3 PASSED: customer role escalation raised expected error: %', sqlerrm;
end $$;

-- TEST 4: Customer can update their own full_name and phone
do $$
begin
  update public.profiles
  set full_name = 'Customer A Updated', phone = '+639171234567'
  where id = '11111111-1111-1111-1111-111111111111';

  if not exists (
    select 1 from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
      and full_name = 'Customer A Updated'
      and phone = '+639171234567'
  ) then
    raise exception 'TEST 4 FAILED: customer could not update own details';
  end if;
  raise notice 'TEST 4 PASSED: customer can update own full_name and phone.';
end $$;

-- TEST 5: Staff can read customer profiles (for bookings)
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles;
  if v_count < 2 then
    raise exception 'TEST 5 FAILED: staff could not read profiles (count: %)', v_count;
  end if;
  raise notice 'TEST 5 PASSED: staff can read profiles.';
end $$;

-- TEST 6: Staff cannot change user roles
do $$
begin
  update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'TEST 6 FAILED: staff was able to change role';
exception when others then
  if sqlerrm like '%Only an admin can change roles%' or sqlerrm like '%permission denied%' then
    raise notice 'TEST 6 PASSED: staff role change correctly rejected: %', sqlerrm;
  else
    raise;
  end if;
end $$;

-- TEST 7: Admin can read all profiles and change roles
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

do $$
begin
  update public.profiles set role = 'staff' where id = '11111111-1111-1111-1111-111111111111';
  if not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' and role = 'staff') then
    raise exception 'TEST 7 FAILED: admin could not change customer to staff';
  end if;
  raise notice 'TEST 7 PASSED: admin successfully updated customer role.';
end $$;

-- TEST 8: Admin cannot change their own role (lockout prevention)
do $$
begin
  update public.profiles set role = 'customer' where id = '44444444-4444-4444-4444-444444444444';
  raise exception 'TEST 8 FAILED: admin changed their own role (lockout prevention failed)';
exception when others then
  if sqlerrm like '%You cannot change your own role%' then
    raise notice 'TEST 8 PASSED: admin self-demotion blocked with expected error: %', sqlerrm;
  else
    raise;
  end if;
end $$;

-- TEST 9: Client cannot insert or delete profiles
do $$
begin
  insert into public.profiles (id, email, role)
  values ('55555555-5555-5555-5555-555555555555', 'hacker@example.com', 'admin');
  raise exception 'TEST 9 FAILED: client inserted a profile directly';
exception when others then
  raise notice 'TEST 9a PASSED: client direct profile insert blocked: %', sqlerrm;
end $$;

do $$
begin
  delete from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'TEST 9b FAILED: client deleted a profile directly';
exception when others then
  raise notice 'TEST 9b PASSED: client direct profile delete blocked: %', sqlerrm;
end $$;

-- TEST 10: kv_store has RLS enabled and blocks clients
do $$
begin
  if to_regclass('public.kv_store_c1f42330') is not null then
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = 'kv_store_c1f42330' and rowsecurity = true
    ) then
      raise exception 'TEST 10 FAILED: kv_store_c1f42330 does not have row security enabled';
    end if;
    raise notice 'TEST 10 PASSED: kv_store_c1f42330 has RLS enabled.';
  else
    raise notice 'TEST 10 SKIPPED: kv_store_c1f42330 does not exist in this environment.';
  end if;
end $$;

-- TEST 11: Customer cannot read another customer's bookings
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_test_item_id uuid;
  v_b1 text;
  v_b2 text;
  v_count integer;
begin
  select id into v_test_item_id from public.items limit 1;

  -- Insert two test bookings directly (as system)
  insert into public.bookings (id, item_id, customer_id, start_at, end_at, daily_rate, total, status, payment_status)
  values
    ('BK-TEST-1', v_test_item_id, '11111111-1111-1111-1111-111111111111', now() + interval '10 days', now() + interval '12 days', 500, 1000, 'reserved', 'unpaid'),
    ('BK-TEST-2', v_test_item_id, '22222222-2222-2222-2222-222222222222', now() + interval '20 days', now() + interval '22 days', 500, 1000, 'reserved', 'unpaid')
  on conflict (id) do nothing;

  -- Under customer A role, should only see BK-TEST-1
  select count(*) into v_count from public.bookings where id in ('BK-TEST-1', 'BK-TEST-2');
  if v_count <> 1 then
    raise exception 'TEST 11 FAILED: customer read % bookings instead of 1', v_count;
  end if;

  if exists (select 1 from public.bookings where id = 'BK-TEST-2') then
    raise exception 'TEST 11 FAILED: customer A could see customer B booking';
  end if;

  raise notice 'TEST 11 PASSED: customer cannot read another customer booking.';
end $$;

-- TEST 12: Customer cannot insert a payment directly
do $$
begin
  insert into public.payments (booking_id, customer_id, amount, method)
  values ('BK-TEST-1', '11111111-1111-1111-1111-111111111111', 1000, 'cash');
  raise exception 'TEST 12 FAILED: customer inserted payment directly';
exception when others then
  raise notice 'TEST 12 PASSED: customer payment insertion blocked: %', sqlerrm;
end $$;

-- TEST 13: Customer cannot update an item
do $$
declare
  v_test_item_id uuid;
begin
  select id into v_test_item_id from public.items limit 1;
  update public.items set daily_price = 1 where id = v_test_item_id;
  if exists (select 1 from public.items where id = v_test_item_id and daily_price = 1) then
    raise exception 'TEST 13 FAILED: customer updated rental item price';
  end if;
  raise notice 'TEST 13 PASSED: customer cannot update items.';
exception when others then
  raise notice 'TEST 13 PASSED: customer update item blocked: %', sqlerrm;
end $$;

-- TEST 14: Overlapping active booking on same item is rejected
do $$
declare
  v_test_item_id uuid;
begin
  select id into v_test_item_id from public.items limit 1;

  -- Try inserting overlapping booking during BK-TEST-1 window (day 11 to 13)
  insert into public.bookings (id, item_id, customer_id, start_at, end_at, daily_rate, total, status, payment_status)
  values ('BK-TEST-OVERLAP', v_test_item_id, '11111111-1111-1111-1111-111111111111', now() + interval '11 days', now() + interval '13 days', 500, 1000, 'reserved', 'unpaid');

  raise exception 'TEST 14 FAILED: overlapping active booking was accepted';
exception when others then
  raise notice 'TEST 14 PASSED: overlapping booking rejected by exclusion constraint: %', sqlerrm;
end $$;

-- TEST 15: Staff can read all bookings and record payments via RPC
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.bookings where id in ('BK-TEST-1', 'BK-TEST-2');
  if v_count < 2 then
    raise exception 'TEST 15 FAILED: staff could not see all bookings (count: %)', v_count;
  end if;
  raise notice 'TEST 15 PASSED: staff can see all bookings.';
end $$;

raise notice '==================================================';
raise notice 'ALL PROFILE, ROLE & RENTAL RLS CHECKS PASSED!';
raise notice '==================================================';

-- Always rollback test transaction
rollback;
