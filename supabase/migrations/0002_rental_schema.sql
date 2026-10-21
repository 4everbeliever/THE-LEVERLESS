-- Toolshed Rentals: branches, items, bookings, booking_extras, payments and maintenance_logs
-- Migration 0002: Real rental schema, RPC functions, and server-side calculations
-- Safe to run multiple times.

-- 1. Required extensions ----------------------------------------------------
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
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  branch_id   uuid not null references public.branches (id) on delete restrict,
  serial      text not null unique,
  status      text not null default 'available' check (status in ('available', 'rented_out', 'maintenance', 'damaged')),
  daily_price numeric(10, 2) not null check (daily_price >= 0),
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.items enable row level security;

-- 5. Bookings table ----------------------------------------------------------
create table if not exists public.bookings (
  id              text primary key default ('BK-' || nextval('public.booking_seq')::text),
  item_id         uuid not null references public.items (id) on delete restrict,
  customer_id     uuid not null references auth.users (id) on delete cascade,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  daily_rate      numeric(10, 2) not null default 0 check (daily_rate >= 0),
  rental_days     integer not null default 1 check (rental_days >= 1),
  rental_subtotal numeric(10, 2) not null default 0 check (rental_subtotal >= 0),
  extras_total    numeric(10, 2) not null default 0 check (extras_total >= 0),
  total           numeric(10, 2) not null default 0 check (total >= 0),
  status          text not null default 'reserved' check (status in ('reserved', 'checked_out', 'returned', 'cancelled')),
  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  condition_notes text,
  return_notes    text,
  is_damaged      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint valid_dates check (end_at > start_at)
);

alter table public.bookings enable row level security;

-- Double-booking exclusion constraint: active bookings only
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prevent_overlapping_bookings'
  ) then
    alter table public.bookings
      add constraint prevent_overlapping_bookings
      exclude using gist (
        item_id with =,
        tstzrange(start_at, end_at, '[)') with &&
      )
      where (status in ('reserved', 'checked_out'));
  end if;
end $$;

-- 6. Booking Extras table ----------------------------------------------------
create table if not exists public.booking_extras (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null references public.bookings (id) on delete cascade,
  extra_type  text not null check (extra_type in ('delivery', 'insurance', 'other')),
  name        text not null,
  quantity    integer not null default 1 check (quantity >= 1),
  price       numeric(10, 2) not null check (price >= 0),
  created_at  timestamptz not null default now()
);

alter table public.booking_extras enable row level security;

-- 7. Payments table ----------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  amount      numeric(10, 2) not null check (amount > 0),
  method      text not null check (method in ('cash', 'gcash', 'card', 'bank_transfer')),
  paid_at     timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.payments enable row level security;

-- 8. Maintenance Logs table --------------------------------------------------
create table if not exists public.maintenance_logs (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items (id) on delete cascade,
  description  text not null,
  hours_spent  numeric(5, 2) not null default 0 check (hours_spent >= 0),
  performed_at date not null default current_date,
  performed_by uuid references auth.users (id) on delete set null,
  staff_name   text,
  created_at   timestamptz not null default now()
);

alter table public.maintenance_logs enable row level security;

-- 9. Indexes -----------------------------------------------------------------
create index if not exists idx_items_branch on public.items (branch_id);
create index if not exists idx_bookings_item_dates on public.bookings (item_id, start_at, end_at);
create index if not exists idx_bookings_customer on public.bookings (customer_id);
create index if not exists idx_booking_extras_booking on public.booking_extras (booking_id);
create index if not exists idx_payments_booking on public.payments (booking_id);
create index if not exists idx_payments_customer on public.payments (customer_id);
create index if not exists idx_maintenance_logs_item on public.maintenance_logs (item_id);

-- 10. Automatic updated_at Trigger -------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_items_updated_at on public.items;
create trigger set_items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- 11. RPC Business Logic Functions (SECURITY DEFINER) ------------------------

-- A. Create booking: calculates days, rate, subtotal, extras and total securely on server
create or replace function public.create_booking(
  p_item_id  uuid,
  p_start_at timestamptz,
  p_end_at   timestamptz,
  p_extras   jsonb default '[]'::jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_customer_id uuid;
  v_days integer;
  v_rental_subtotal numeric(10, 2);
  v_extras_total numeric(10, 2) := 0;
  v_booking public.bookings;
  v_extra record;
  v_extra_price numeric(10, 2);
  v_extra_qty integer;
begin
  v_customer_id := auth.uid();
  if v_customer_id is null then
    raise exception 'You must be signed in to book an item.';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'End date must be after start date.';
  end if;

  select id, name, daily_price, status into v_item
  from public.items
  where id = p_item_id;

  if v_item.id is null then
    raise exception 'Rental item not found.';
  end if;

  if v_item.status in ('maintenance', 'damaged') then
    raise exception 'This item is currently undergoing maintenance and cannot be booked.';
  end if;

  -- Calculate days (at least 1 full day)
  v_days := greatest(1, ceil(extract(epoch from (p_end_at - p_start_at)) / 86400)::integer);
  v_rental_subtotal := round(v_item.daily_price * v_days, 2);

  -- Insert initial booking record
  insert into public.bookings (
    item_id,
    customer_id,
    start_at,
    end_at,
    daily_rate,
    rental_days,
    rental_subtotal,
    extras_total,
    total,
    status,
    payment_status
  ) values (
    p_item_id,
    v_customer_id,
    p_start_at,
    p_end_at,
    v_item.daily_price,
    v_days,
    v_rental_subtotal,
    0,
    v_rental_subtotal,
    'reserved',
    'unpaid'
  )
  returning * into v_booking;

  -- Process optional extras
  if p_extras is not null and jsonb_array_length(p_extras) > 0 then
    for v_extra in select * from jsonb_to_recordset(p_extras) as x(extra_type text, name text, quantity integer, price numeric) loop
      v_extra_qty := greatest(1, coalesce(v_extra.quantity, 1));
      v_extra_price := coalesce(v_extra.price, 0);

      insert into public.booking_extras (
        booking_id,
        extra_type,
        name,
        quantity,
        price
      ) values (
        v_booking.id,
        lower(v_extra.extra_type),
        v_extra.name,
        v_extra_qty,
        v_extra_price
      );

      v_extras_total := v_extras_total + (v_extra_price * v_extra_qty);
    end loop;

    -- Update booking with final extras total and total
    update public.bookings
    set extras_total = v_extras_total,
        total = rental_subtotal + v_extras_total,
        updated_at = now()
    where id = v_booking.id
    returning * into v_booking;
  end if;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'This item is already booked for the selected dates.' using errcode = '23P01';
end;
$$;

-- B. Cancel booking: customer can cancel only their OWN booking while reserved
create or replace function public.cancel_booking(p_booking_id text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if v_booking.customer_id <> auth.uid() and not public.is_staff() then
    raise exception 'You can only cancel your own bookings.';
  end if;

  if v_booking.status <> 'reserved' then
    raise exception 'Only reserved bookings can be cancelled.';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- C. Check out booking: staff/admin only, transitions item to rented_out
create or replace function public.check_out_booking(
  p_booking_id      text,
  p_condition_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_staff() then
    raise exception 'Only staff or admin can check out equipment.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status <> 'reserved' then
    raise exception 'Only reserved bookings can be checked out.';
  end if;

  update public.bookings
  set status = 'checked_out',
      condition_notes = coalesce(p_condition_notes, condition_notes),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.items
  set status = 'rented_out', updated_at = now()
  where id = v_booking.item_id;

  return v_booking;
end;
$$;

-- D. Return booking: staff/admin only, updates damaged flag and item status
create or replace function public.return_booking(
  p_booking_id   text,
  p_return_notes text,
  p_damaged      boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_new_status text;
begin
  if not public.is_staff() then
    raise exception 'Only staff or admin can process equipment returns.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status <> 'checked_out' then
    raise exception 'Only checked-out bookings can be returned.';
  end if;

  update public.bookings
  set status = 'returned',
      return_notes = p_return_notes,
      is_damaged = coalesce(p_damaged, false),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  v_new_status := case when p_damaged then 'maintenance' else 'available' end;

  update public.items
  set status = v_new_status, updated_at = now()
  where id = v_booking.item_id;

  return v_booking;
end;
$$;

-- E. Record payment: staff/admin only, recalculates payment_status automatically
create or replace function public.record_payment(
  p_booking_id text,
  p_amount     numeric,
  p_method     text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
  v_total_paid numeric(10, 2);
  v_new_payment_status text;
begin
  if not public.is_staff() then
    raise exception 'Only staff or admin can record payments.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  insert into public.payments (
    booking_id,
    customer_id,
    amount,
    method,
    recorded_by
  ) values (
    p_booking_id,
    v_booking.customer_id,
    p_amount,
    lower(p_method),
    auth.uid()
  )
  returning * into v_payment;

  -- Recompute total paid
  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments
  where booking_id = p_booking_id;

  if v_total_paid >= v_booking.total then
    v_new_payment_status := 'paid';
  elsif v_total_paid > 0 then
    v_new_payment_status := 'partial';
  else
    v_new_payment_status := 'unpaid';
  end if;

  update public.bookings
  set payment_status = v_new_payment_status,
      updated_at = now()
  where id = p_booking_id;

  return v_payment;
end;
$$;

-- 12. Row Level Security Policies --------------------------------------------

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

-- Items
drop policy if exists "items_select_authenticated" on public.items;
drop policy if exists "items_manage_staff"         on public.items;

create policy "items_select_authenticated"
  on public.items for select
  to authenticated
  using (true);

create policy "items_manage_staff"
  on public.items for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Bookings
drop policy if exists "bookings_select"        on public.bookings;
drop policy if exists "bookings_manage_staff"  on public.bookings;

create policy "bookings_select"
  on public.bookings for select
  to authenticated
  using (customer_id = auth.uid() or public.is_staff());

create policy "bookings_manage_staff"
  on public.bookings for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Booking Extras
drop policy if exists "booking_extras_select"       on public.booking_extras;
drop policy if exists "booking_extras_manage_staff" on public.booking_extras;

create policy "booking_extras_select"
  on public.booking_extras for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or public.is_staff())
    )
  );

create policy "booking_extras_manage_staff"
  on public.booking_extras for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Payments: customers read own; staff/admin read & manage
drop policy if exists "payments_select"       on public.payments;
drop policy if exists "payments_manage_staff" on public.payments;

create policy "payments_select"
  on public.payments for select
  to authenticated
  using (customer_id = auth.uid() or public.is_staff());

create policy "payments_manage_staff"
  on public.payments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Maintenance Logs: staff/admin only
drop policy if exists "maintenance_select_staff" on public.maintenance_logs;
drop policy if exists "maintenance_manage_staff" on public.maintenance_logs;

create policy "maintenance_select_staff"
  on public.maintenance_logs for select
  to authenticated
  using (public.is_staff());

create policy "maintenance_manage_staff"
  on public.maintenance_logs for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Grant execute on RPC functions to authenticated
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, jsonb) to authenticated;
grant execute on function public.cancel_booking(text) to authenticated;
grant execute on function public.check_out_booking(text, text) to authenticated;
grant execute on function public.return_booking(text, text, boolean) to authenticated;
grant execute on function public.record_payment(text, numeric, text) to authenticated;

-- 13. Seed Data: Bohol Branches and Sample Items -----------------------------

insert into public.branches (name)
values
  ('Tagbilaran'),
  ('Panglao'),
  ('Tubigon')
on conflict (name) do nothing;

insert into public.items (name, category, branch_id, serial, status, daily_price, image_url)
values
  (
    'Makita Cordless Drill',
    'Power tools',
    (select id from public.branches where name = 'Tagbilaran'),
    'MKD-2024-0182',
    'available',
    450.00,
    'https://images.unsplash.com/photo-1518709414768-a88981a4515d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'DeWalt Circular Saw',
    'Cutting tools',
    (select id from public.branches where name = 'Panglao'),
    'DCS-2023-0089',
    'rented_out',
    650.00,
    'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Bosch Angle Grinder',
    'Power tools',
    (select id from public.branches where name = 'Tagbilaran'),
    'BAG-2024-0115',
    'maintenance',
    380.00,
    'https://images.unsplash.com/photo-1694522362256-6c907336af43?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Heavy Duty Rotary Hammer',
    'Demolition',
    (select id from public.branches where name = 'Tubigon'),
    'HDR-2024-0042',
    'available',
    820.00,
    'https://images.unsplash.com/photo-1546827209-a218e99fdbe9?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Metal Cut-off Machine',
    'Cutting tools',
    (select id from public.branches where name = 'Panglao'),
    'MCM-2023-0106',
    'available',
    720.00,
    'https://images.unsplash.com/photo-1738162837672-de9d735a9b90?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  ),
  (
    'Portable Concrete Mixer',
    'Heavy equipment',
    (select id from public.branches where name = 'Tagbilaran'),
    'PCM-2022-0024',
    'rented_out',
    1350.00,
    'https://images.unsplash.com/photo-1601058268499-e52658b8bb88?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'
  )
on conflict (serial) do update set
  name = excluded.name,
  category = excluded.category,
  branch_id = excluded.branch_id,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url;

-- Sample maintenance logs
insert into public.maintenance_logs (item_id, description, performed_at, hours_spent, staff_name)
select
  i.id,
  m.description,
  m.performed_at::date,
  m.hours_spent,
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
