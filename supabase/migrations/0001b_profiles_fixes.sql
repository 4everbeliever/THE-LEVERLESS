-- Toolshed Rentals: Profile enhancements and security hardening
-- Migration 0001b: Profile fixes & RLS tightening
-- Safe to run multiple times.

-- 1. Tighten function execution permissions ----------------------------------
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin()         from public, anon;
revoke all on function public.is_staff()         from public, anon;
revoke all on function public.handle_new_user()  from public, anon;
revoke all on function public.protect_role_change() from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin()         to authenticated;
grant execute on function public.is_staff()         to authenticated;

-- 2. Make profiles.email nullable (safe for phone logins/auth providers) -----
alter table public.profiles alter column email drop not null;

-- 3. Add full_name and phone to profiles -------------------------------------
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;

-- 4. Update signup trigger to populate full_name from metadata ---------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    'customer',
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

-- 5. Staff & Admin can read other profiles (for bookings customer lookup) ---
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff"
  on public.profiles for select
  to authenticated
  using (public.is_staff());

-- 6. Users can update their own profile details (full_name, phone) ----------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 7. Hardened role change & profile update protection ------------------------
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard role changes
  if new.role is distinct from old.role then
    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'Only an admin can change roles';
      end if;

      if old.id = auth.uid() then
        raise exception 'You cannot change your own role';
      end if;
    end if;
  else
    -- Non-role update (e.g. user updating their own full_name/phone)
    new.role := old.role;
  end if;

  -- Client cannot tamper with system-managed identity fields
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;
