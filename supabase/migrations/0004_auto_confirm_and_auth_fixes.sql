-- Toolshed Rentals: Auto-confirm user signups & fix unconfirmed accounts
-- Migration 0004: Auto-confirm accounts and backfill profiles
-- Safe to run multiple times in Supabase SQL Editor (project ophgpdwzoeuheshcfrrc).

-- 1. Auto-confirm any newly registered user so they can sign in immediately
--    without requiring an email confirmation link or hitting SMTP rate limits.
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_before_insert_confirm on auth.users;
create trigger on_auth_user_before_insert_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- 2. Confirm all existing unconfirmed users so they can sign in right away
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 3. Ensure all auth.users have an entry in public.profiles with role 'customer'
insert into public.profiles (id, email, role)
select
  u.id,
  u.email,
  'customer'::public.app_role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
