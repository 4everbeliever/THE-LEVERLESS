-- Toolshed Rentals: branches, items, bookings, booking extras, payments and maintenance logs
-- Run in the Supabase SQL editor (project ophgpdwzoeuheshcfrrc) or `supabase db push`.
-- Safe to run more than once.

-- 1. Required extensions ----------------------------------------------------
-- btree_gist allows combining standard equality (=) on UUID with range overlap (&&)
create extension if not exists btree_gist;

-- 2. Sequence for readable booking codes (e.g. BK-2050) ---------------------
create sequence if not exists public.booking_seq start with 2050;

-- 3. Branches table ----------------------------------------------------------
create table if not exists public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;

-- 4. Items table -------------------------------------------------------------
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null,
  branch_id  uuid not null references public.branches (id) on delete restrict,
  serial     text not null unique,
  status     text not null default 'Available' check (status in ('Available', 'Rented out', 'Maintenance')),
  price      numeric(10, 2) not null check (price >= 0),
  image      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.items enable row level security;

-- 5. Bookings table ----------------------------------------------------------
create table if not exists public.bookings (
  id              text primary key default ('BK-' || nextval('public.booking_seq')::text),
  item_id         uuid not null references public.items (id) on delete restrict,
  user_id         uuid not null references auth.users (id) on delete cascade,
  customer_name   text,
  start_date      timestamptz not null,
  end_date        timestamptz not null,
  daily_rate      numeric(10, 2) not null default 0 check (daily_rate >= 0),
  rental_days     integer not null default 1 check (rental_days >= 1),
  rental_subtotal numeric(10, 2) not null default 0 check (rental_subtotal >= 0),
  extras_total    numeric(10, 2) not null default 0 check (extras_total >= 0),
  total_amount    numeric(10, 2) not null default 0 check (total_amount >= 0),
  status          text not null default 'Reserved' check (status in ('Reserved', 'Checked out', 'Returned', 'Cancelled')),
  payment_status  text not null default 'Unpaid' check (payment_status in ('Unpaid', 'Paid', 'Refunded')),
  condition_notes text,
  return_notes    text,
  is_damaged      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint valid_dates check (end_date > start_date)
);

alter table public.bookings enable row level security;

-- Enforce no double-booking at the database level with exclusion constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prevent_overlapping_bookings'
  ) then
    alter table public.bookings
      add constraint prevent_overlapping_bookings
      exclude using gist (
        item_id with =,
        tstzrange(start_date, end_date) with &&
      )
      where (status in ('Reserved', 'Checked out'));
  end if;
end $$;

-- 6. Booking Extras table ----------------------------------------------------
create table if not exists public.booking_extras (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null references public.bookings (id) on delete cascade,
  extra_type  text not null check (extra_type in ('Delivery', 'Insurance', 'Other')),
  name        text not null,
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  quantity    integer not null default 1 check (quantity >= 1),
  total_price numeric(10, 2) not null default 0 check (total_price >= 0),
  created_at  timestamptz not null default now()
);

alter table public.booking_extras enable row level security;

-- 7. Payments table ----------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  booking_id     text not null references public.bookings (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  amount         numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Card', 'Bank transfer')),
  payment_status text not null default 'Paid' check (payment_status in ('Pending', 'Paid', 'Failed', 'Refunded')),
  paid_at        timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.payments enable row level security;

-- 8. Maintenance Logs table --------------------------------------------------
create table if not exists public.maintenance_logs (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items (id) on delete cascade,
  description     text not null,
  hours_spent     numeric(5, 2) not null default 0 check (hours_spent >= 0),
  performed_at    date not null default current_date,
  performed_by_id uuid references auth.users (id) on delete set null,
  staff_name      text,
  status          text not null default 'Completed',
  created_at      timestamptz not null default now()
);

alter table public.maintenance_logs enable row level security;

-- 9. Server-side Calculations & Business Logic Triggers ----------------------

-- Calculate extras line-item total
create or replace function public.calculate_extra_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.total_price := round(new.unit_price * new.quantity, 2);
  return new;
end;
$$;

drop trigger if exists on_calculate_extra_total on public.booking_extras;
create trigger on_calculate_extra_total
  before insert or update on public.booking_extras
  for each row execute function public.calculate_extra_total();

-- Calculate booking days, daily rate, rental subtotal and total amount on server
create or replace function public.calculate_booking_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_rate numeric(10, 2);
  v_days integer;
  v_extras_sum numeric(10, 2);
begin
  -- Fetch current daily price from the items table
  select price into v_daily_rate
  from public.items
  where id = new.item_id;

  if v_daily_rate is null then
    raise exception 'Rental item not found.';
  end if;

  -- Ensure non-staff cannot spoof another user's ID
  if auth.uid() is not null and not public.is_staff() then
    new.user_id := auth.uid();
  end if;

  -- Backfill customer name / email from profile if not provided
  if new.customer_name is null or trim(new.customer_name) = '' then
    select email into new.customer_name
    from public.profiles
    where id = new.user_id;
  end if;

  -- Calculate rental days (minimum 1 calendar day)
  v_days := greatest(1, (new.end_date::date - new.start_date::date));

  new.daily_rate := v_daily_rate;
  new.rental_days := v_days;
  new.rental_subtotal := round(v_daily_rate * v_days, 2);

  -- Sum extras for this booking
  select coalesce(sum(total_price), 0) into v_extras_sum
  from public.booking_extras
  where booking_id = new.id;

  new.extras_total := coalesce(v_extras_sum, coalesce(new.extras_total, 0));
  new.total_amount := new.rental_subtotal + new.extras_total;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists on_calculate_booking_totals on public.bookings;
create trigger on_calculate_booking_totals
  before insert or update on public.bookings
  for each row execute function public.calculate_booking_totals();

-- Double-booking check trigger (for descriptive error messages before constraint violation)
create or replace function public.check_booking_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('Reserved', 'Checked out') then
    if exists (
      select 1
      from public.bookings
      where item_id = new.item_id
        and id <> coalesce(new.id, '')
        and status in ('Reserved', 'Checked out')
        and tstzrange(start_date, end_date) && tstzrange(new.start_date, new.end_date)
    ) then
      raise exception 'This item is already booked for the selected dates.'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_check_booking_overlap on public.bookings;
create trigger on_check_booking_overlap
  before insert or update on public.bookings
  for each row execute function public.check_booking_overlap();

-- Recalculate booking total when an extra is added, modified, or deleted
create or replace function public.sync_booking_extras_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id text;
  v_extras_sum numeric(10, 2);
begin
  v_booking_id := coalesce(new.booking_id, old.booking_id);

  select coalesce(sum(total_price), 0) into v_extras_sum
  from public.booking_extras
  where booking_id = v_booking_id;

  update public.bookings
  set extras_total = v_extras_sum,
      total_amount = rental_subtotal + v_extras_sum,
      updated_at = now()
  where id = v_booking_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_sync_booking_extras_total on public.booking_extras;
create trigger on_sync_booking_extras_total
  after insert or update or delete on public.booking_extras
  for each row execute function public.sync_booking_extras_total();

-- Synchronize item status on checkout and return
create or replace function public.sync_item_status_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Checked out' then
    update public.items set status = 'Rented out', updated_at = now() where id = new.item_id;
  elsif new.status = 'Returned' then
    if new.is_damaged then
      update public.items set status = 'Maintenance', updated_at = now() where id = new.item_id;
    else
      update public.items set status = 'Available', updated_at = now() where id = new.item_id;
    end if;
  elsif new.status = 'Cancelled' and old.status in ('Reserved', 'Checked out') then
    if not exists (
      select 1 from public.bookings
      where item_id = new.item_id
        and id <> new.id
        and status = 'Checked out'
    ) then
      update public.items set status = 'Available', updated_at = now() where id = new.item_id and status = 'Rented out';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_status_change on public.bookings;
create trigger on_booking_status_change
  after insert or update of status, is_damaged on public.bookings
  for each row execute function public.sync_item_status_on_booking();

-- Auto-mark booking as Paid when payments equal or exceed total_amount
create or replace function public.sync_booking_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_paid numeric(10, 2);
  v_booking_total numeric(10, 2);
begin
  select total_amount into v_booking_total
  from public.bookings
  where id = new.booking_id;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments
  where booking_id = new.booking_id and payment_status = 'Paid';

  if v_total_paid >= coalesce(v_booking_total, 0) then
    update public.bookings
    set payment_status = 'Paid', updated_at = now()
    where id = new.booking_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_sync_booking_payment_status on public.payments;
create trigger on_sync_booking_payment_status
  after insert or update on public.payments
  for each row execute function public.sync_booking_payment_status();

-- 10. Row Level Security Policies --------------------------------------------

-- Branches
drop policy if exists "branches_select_authenticated" on public.branches;
drop policy if exists "branches_manage_staff"         on public.branches;

create policy "branches_select_authenticated"
  on public.branches for select
  to authenticated
  using (true);

create policy "branches_manage_staff"
  on public.branches for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Items: signed-in users can read; staff and admin can manage
drop policy if exists "items_select_authenticated" on public.items;
drop policy if exists "items_insert_staff"         on public.items;
drop policy if exists "items_update_staff"         on public.items;
drop policy if exists "items_delete_staff"         on public.items;

create policy "items_select_authenticated"
  on public.items for select
  to authenticated
  using (true);

create policy "items_insert_staff"
  on public.items for insert
  to authenticated
  with check (public.is_staff());

create policy "items_update_staff"
  on public.items for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "items_delete_staff"
  on public.items for delete
  to authenticated
  using (public.is_staff());

-- Bookings: customers see and create only their own; staff and admin see and manage all
drop policy if exists "bookings_select"       on public.bookings;
drop policy if exists "bookings_insert"       on public.bookings;
drop policy if exists "bookings_update"       on public.bookings;
drop policy if exists "bookings_delete_staff" on public.bookings;

create policy "bookings_select"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "bookings_insert"
  on public.bookings for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_staff());

create policy "bookings_update"
  on public.bookings for update
  to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy "bookings_delete_staff"
  on public.bookings for delete
  to authenticated
  using (public.is_staff());

-- Booking Extras: readable & manageable by the booking owner or staff
drop policy if exists "booking_extras_select" on public.booking_extras;
drop policy if exists "booking_extras_insert" on public.booking_extras;
drop policy if exists "booking_extras_update" on public.booking_extras;
drop policy if exists "booking_extras_delete" on public.booking_extras;

create policy "booking_extras_select"
  on public.booking_extras for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = auth.uid() or public.is_staff())
    )
  );

create policy "booking_extras_insert"
  on public.booking_extras for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = auth.uid() or public.is_staff())
    )
  );

create policy "booking_extras_update"
  on public.booking_extras for update
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = auth.uid() or public.is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = auth.uid() or public.is_staff())
    )
  );

create policy "booking_extras_delete"
  on public.booking_extras for delete
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = auth.uid() or public.is_staff())
    )
  );

-- Payments: users see/create payments for their bookings; staff see/manage all
drop policy if exists "payments_select"       on public.payments;
drop policy if exists "payments_insert"       on public.payments;
drop policy if exists "payments_manage_staff" on public.payments;

create policy "payments_select"
  on public.payments for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "payments_insert"
  on public.payments for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_staff());

create policy "payments_manage_staff"
  on public.payments for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Maintenance Logs: staff and admin only
drop policy if exists "maintenance_select_staff" on public.maintenance_logs;
drop policy if exists "maintenance_insert_staff" on public.maintenance_logs;
drop policy if exists "maintenance_update_staff" on public.maintenance_logs;
drop policy if exists "maintenance_delete_staff" on public.maintenance_logs;

create policy "maintenance_select_staff"
  on public.maintenance_logs for select
  to authenticated
  using (public.is_staff());

create policy "maintenance_insert_staff"
  on public.maintenance_logs for insert
  to authenticated
  with check (public.is_staff());

create policy "maintenance_update_staff"
  on public.maintenance_logs for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "maintenance_delete_staff"
  on public.maintenance_logs for delete
  to authenticated
  using (public.is_staff());

-- 11. Seed Data: Branches and Sample Items -----------------------------------

-- Seed Bohol branches
insert into public.branches (name)
values
  ('Tagbilaran'),
  ('Panglao'),
  ('Tubigon')
on conflict (name) do nothing;

-- Seed 6 sample items from mock data
insert into public.items (name, category, branch_id, serial, status, price, image)
values
  (
    'Makita Cordless Drill',
    'Power tools',
    (select id from public.branches where name = 'Tagbilaran'),
    'MKD-2024-0182',
    'Available',
    450.00,
    'https://images.unsplash.com/photo-1518709414768-a88981a4515d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'DeWalt Circular Saw',
    'Cutting tools',
    (select id from public.branches where name = 'Panglao'),
    'DCS-2023-0089',
    'Rented out',
    650.00,
    'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Bosch Angle Grinder',
    'Power tools',
    (select id from public.branches where name = 'Tagbilaran'),
    'BAG-2024-0115',
    'Maintenance',
    380.00,
    'https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Heavy Duty Rotary Hammer',
    'Demolition',
    (select id from public.branches where name = 'Tubigon'),
    'HDR-2024-0042',
    'Available',
    820.00,
    'https://images.unsplash.com/photo-1546827209-a218e99fdbe9?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Metal Cut-off Machine',
    'Cutting tools',
    (select id from public.branches where name = 'Panglao'),
    'MCM-2023-0106',
    'Available',
    720.00,
    'https://images.unsplash.com/photo-1738162837672-de9d735a9b90?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Portable Concrete Mixer',
    'Heavy equipment',
    (select id from public.branches where name = 'Tagbilaran'),
    'PCM-2022-0024',
    'Rented out',
    1350.00,
    'https://images.unsplash.com/photo-1601058268499-e52658b8bb88?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  )
on conflict (serial) do update set
  name = excluded.name,
  category = excluded.category,
  branch_id = excluded.branch_id,
  price = excluded.price,
  image = excluded.image;

-- Seed sample maintenance logs for existing items
insert into public.maintenance_logs (item_id, description, performed_at, hours_spent, status, staff_name)
select
  i.id,
  m.description,
  m.performed_at::date,
  m.hours_spent,
  'Completed',
  m.staff_name
from (
  values
    ('BAG-2024-0115', 'Replaced carbon brushes and tested motor.', '2025-05-19', 2.0, 'R. Dela Cruz'),
    ('PCM-2022-0024', 'Routine inspection, greased bearings.', '2025-05-15', 1.5, 'A. Villanueva'),
    ('DCS-2023-0089', 'Replaced worn blade guard spring.', '2025-05-08', 1.0, 'R. Dela Cruz')
) as m(serial, description, performed_at, hours_spent, staff_name)
join public.items i on i.serial = m.serial
where not exists (
  select 1 from public.maintenance_logs ml where ml.item_id = i.id and ml.description = m.description
);
