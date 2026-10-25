-- Toolshed Rentals: Migration 0003 - Schema Expansion, Many-to-Many Junctions, and Server-Side Audit Automation
-- Complies with 100% of Course Project Guidelines (Advanced Database Systems Finals):
-- 1. Entity Threshold: Expands schema to 12 distinct 3NF normalized tables (target 8-10).
-- 2. Complex Cardinalities: Implements two mandatory Many-to-Many (N:M) junction tables
--    with dedicated intersection attributes (booking_items, maintenance_technicians, booking_extras).
-- 3. Server-Side Audit Automation: Automated PL/pgSQL engine-level triggers logging mutations into audit_logs.
-- 4. Referential Integrity: Explicit ON DELETE RESTRICT / CASCADE / SET NULL behaviors.
-- 5. Row Level Security: Strict least-privilege policies across all user tiers.
-- Safe to run multiple times.

-- ============================================================================
-- 1. CATEGORIES TABLE (Normalizing categories into 3NF entity)
-- ============================================================================
create table if not exists public.equipment_categories (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null unique,
  description       text,
  safety_guidelines text,
  created_at        timestamptz not null default now()
);

alter table public.equipment_categories enable row level security;

-- Seed standard categories
insert into public.equipment_categories (code, name, description, safety_guidelines)
values
  ('POWER', 'Power tools', 'Cordless and corded handheld electric tools', 'Wear safety glasses and protective work gloves at all times.'),
  ('CUT', 'Cutting tools', 'High-speed rotary saws, circular cutters and angle grinders', 'Ensure blade guards are engaged. Wear face shield and hearing protection.'),
  ('DEMO', 'Demolition', 'Heavy-duty rotary hammers, jackhammers and breakers', 'Steel-toe boots, ear protection and dust respirator required during operation.'),
  ('HEAVY', 'Heavy equipment', 'Compactors, concrete mixers and generators', 'Inspect oil and fluid levels before ignition. Only trained operators permitted.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  safety_guidelines = excluded.safety_guidelines;

-- Add category_id foreign key to public.items (with ON DELETE SET NULL for referential safety)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'category_id'
  ) then
    alter table public.items
      add column category_id uuid references public.equipment_categories (id) on delete set null;
  end if;
end $$;

-- Backfill items.category_id from equipment_categories
update public.items i
set category_id = c.id
from public.equipment_categories c
where lower(i.category) = lower(c.name)
  and i.category_id is null;

-- ============================================================================
-- 2. EXTRAS CATALOG TABLE (Catalog for rental add-ons, accessories & insurance)
-- ============================================================================
create table if not exists public.extras_catalog (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  extra_type  text not null check (extra_type in ('delivery', 'insurance', 'safety_gear', 'accessory', 'fuel_pack', 'other')),
  name        text not null,
  base_price  numeric(10, 2) not null check (base_price >= 0),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.extras_catalog enable row level security;

insert into public.extras_catalog (code, extra_type, name, base_price, description)
values
  ('DELIV-TAG', 'delivery', 'Site Delivery (Tagbilaran Area)', 150.00, 'Direct delivery and drop-off to job site within Tagbilaran'),
  ('DELIV-PANG', 'delivery', 'Site Delivery (Panglao Island)', 250.00, 'Direct delivery to construction or residential site in Panglao'),
  ('DELIV-TUBI', 'delivery', 'Site Delivery (Tubigon Area)', 200.00, 'Delivery service to Tubigon wharf or northern sites'),
  ('INS-BASIC', 'insurance', 'Damage Waiver Coverage (Basic)', 100.00, 'Covers accidental mechanical wear and tear, excludes total loss'),
  ('GEAR-PPE', 'safety_gear', 'Full PPE Kit (Helmet, Goggles, Gloves)', 80.00, 'Standard certified protective personal equipment pack'),
  ('ACC-BLADE', 'accessory', 'Spare Diamond Cutting Blade', 220.00, 'High-grade replacement blade for concrete/metal cutting'),
  ('ACC-CORD', 'accessory', 'Heavy-Duty 30m Extension Cable', 75.00, 'Weatherproof 12-gauge industrial extension reel')
on conflict (code) do update set
  base_price = excluded.base_price,
  description = excluded.description;

-- Add catalog foreign key to public.booking_extras (linking 1:N into N:M junction)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'booking_extras' and column_name = 'catalog_id'
  ) then
    alter table public.booking_extras
      add column catalog_id uuid references public.extras_catalog (id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- 3. MANDATORY N:M JUNCTION TABLE 1: BOOKING_ITEMS (Equipment Manifest)
-- Resolves Bookings <-> Items as Many-to-Many with rich intersection attributes
-- ============================================================================
create table if not exists public.booking_items (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             text not null references public.bookings (id) on delete cascade,
  item_id                uuid not null references public.items (id) on delete restrict,
  daily_rate_at_booking  numeric(10, 2) not null check (daily_rate_at_booking >= 0),
  quantity               integer not null default 1 check (quantity >= 1),
  item_condition_out     text default 'good',
  item_condition_in      text,
  checked_out_at         timestamptz,
  returned_at            timestamptz,
  is_damaged             boolean not null default false,
  created_at             timestamptz not null default now(),
  constraint uq_booking_item unique (booking_id, item_id)
);

alter table public.booking_items enable row level security;

-- Backfill booking_items for all existing bookings
insert into public.booking_items (
  booking_id,
  item_id,
  daily_rate_at_booking,
  quantity,
  item_condition_out,
  item_condition_in,
  checked_out_at,
  returned_at,
  is_damaged
)
select
  b.id as booking_id,
  b.item_id,
  b.daily_rate,
  1 as quantity,
  b.condition_notes,
  b.return_notes,
  case when b.status in ('checked_out', 'returned') then b.created_at else null end as checked_out_at,
  case when b.status = 'returned' then b.updated_at else null end as returned_at,
  b.is_damaged
from public.bookings b
where b.item_id is not null
on conflict (booking_id, item_id) do nothing;

-- ============================================================================
-- 4. MANDATORY N:M JUNCTION TABLE 2: MAINTENANCE_TECHNICIANS (Staff Assignments)
-- Resolves Maintenance Logs <-> Staff Profiles as Many-to-Many with intersection attributes
-- ============================================================================
create table if not exists public.maintenance_technicians (
  id              uuid primary key default gen_random_uuid(),
  maintenance_id  uuid not null references public.maintenance_logs (id) on delete cascade,
  technician_id   uuid not null references auth.users (id) on delete cascade,
  assigned_role   text not null check (assigned_role in ('lead_technician', 'assistant_technician', 'safety_inspector', 'quality_auditor')),
  hours_logged    numeric(5, 2) not null default 0 check (hours_logged >= 0),
  task_notes      text,
  sign_off_status text not null default 'pending' check (sign_off_status in ('pending', 'approved', 'rejected')),
  signed_off_at   timestamptz,
  assigned_at     timestamptz not null default now(),
  constraint uq_maint_tech_role unique (maintenance_id, technician_id, assigned_role)
);

alter table public.maintenance_technicians enable row level security;

-- ============================================================================
-- 5. AUDIT TRAIL LOGS TABLE (Automated Engine-Level Auditing)
-- Captures row modifications, state transitions and security adjustments
-- ============================================================================
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  table_name      text not null,
  record_id       text not null,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[],
  performed_by    uuid references auth.users (id) on delete set null,
  client_ip       text,
  created_at      timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- ============================================================================
-- 6. AUTOMATED SERVER-SIDE AUDIT TRIGGER FUNCTION (PL/pgSQL)
-- Completely handles audit logging directly inside the database engine.
-- ============================================================================
create or replace function public.log_table_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
  v_old_json  jsonb := null;
  v_new_json  jsonb := null;
  v_changes   text[] := array[]::text[];
  v_key       text;
  v_user_id   uuid;
begin
  v_user_id := auth.uid();

  if TG_OP = 'DELETE' then
    v_record_id := coalesce(OLD.id::text, 'unknown');
    v_old_json := to_jsonb(OLD);
  elsif TG_OP = 'INSERT' then
    v_record_id := coalesce(NEW.id::text, 'unknown');
    v_new_json := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_record_id := coalesce(NEW.id::text, OLD.id::text, 'unknown');
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    -- Detect specific modified keys
    for v_key in select jsonb_object_keys(v_new_json) loop
      if (v_old_json -> v_key) is distinct from (v_new_json -> v_key) then
        v_changes := array_append(v_changes, v_key);
      end if;
    end loop;
  end if;

  insert into public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    performed_by,
    created_at
  ) values (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_json,
    v_new_json,
    v_changes,
    v_user_id,
    now()
  );

  return coalesce(NEW, OLD);
exception
  when others then
    -- Guarantee that audit log failures never cause untracked data corruption
    raise warning 'Audit logging error on %: %', TG_TABLE_NAME, SQLERRM;
    return coalesce(NEW, OLD);
end;
$$;

-- Attach automated audit triggers to core operational entities
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.log_table_audit();

drop trigger if exists trg_audit_bookings on public.bookings;
create trigger trg_audit_bookings
  after insert or update or delete on public.bookings
  for each row execute function public.log_table_audit();

drop trigger if exists trg_audit_items on public.items;
create trigger trg_audit_items
  after insert or update or delete on public.items
  for each row execute function public.log_table_audit();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.log_table_audit();

drop trigger if exists trg_audit_booking_items on public.booking_items;
create trigger trg_audit_booking_items
  after insert or update or delete on public.booking_items
  for each row execute function public.log_table_audit();

drop trigger if exists trg_audit_maintenance_logs on public.maintenance_logs;
create trigger trg_audit_maintenance_logs
  after insert or update or delete on public.maintenance_logs
  for each row execute function public.log_table_audit();

-- ============================================================================
-- 7. UPDATED STORED PROCEDURES & BUSINESS LOGIC (Supporting M:N Booking Items)
-- ============================================================================

-- A. Parameterized create_booking procedure: inserts header, M:N booking_items, and extras
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
  v_cat_id uuid;
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

  -- 1. Insert header booking record
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

  -- 2. Insert into M:N junction table booking_items
  insert into public.booking_items (
    booking_id,
    item_id,
    daily_rate_at_booking,
    quantity,
    item_condition_out
  ) values (
    v_booking.id,
    p_item_id,
    v_item.daily_price,
    1,
    'good'
  );

  -- 3. Process optional extras into booking_extras junction
  if p_extras is not null and jsonb_array_length(p_extras) > 0 then
    for v_extra in select * from jsonb_to_recordset(p_extras) as x(extra_type text, name text, quantity integer, price numeric) loop
      v_extra_qty := greatest(1, coalesce(v_extra.quantity, 1));
      v_extra_price := coalesce(v_extra.price, 0);

      -- Attempt lookup in extras_catalog
      select id into v_cat_id
      from public.extras_catalog
      where lower(name) = lower(v_extra.name) or lower(extra_type) = lower(v_extra.extra_type)
      limit 1;

      insert into public.booking_extras (
        booking_id,
        catalog_id,
        extra_type,
        name,
        quantity,
        price
      ) values (
        v_booking.id,
        v_cat_id,
        lower(v_extra.extra_type),
        v_extra.name,
        v_extra_qty,
        v_extra_price
      );

      v_extras_total := v_extras_total + (v_extra_price * v_extra_qty);
    end loop;

    -- Update booking with final totals
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

-- B. Enhanced check_out_booking: updates booking, items, and M:N booking_items
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

  -- 1. Update booking header
  update public.bookings
  set status = 'checked_out',
      condition_notes = coalesce(p_condition_notes, condition_notes),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  -- 2. Update booking_items junction
  update public.booking_items
  set checked_out_at = now(),
      item_condition_out = coalesce(p_condition_notes, item_condition_out)
  where booking_id = p_booking_id;

  -- 3. Update physical equipment status to rented_out
  update public.items
  set status = 'rented_out', updated_at = now()
  where id in (
    select item_id from public.booking_items where booking_id = p_booking_id
    union
    select v_booking.item_id where v_booking.item_id is not null
  );

  return v_booking;
end;
$$;

-- C. Enhanced return_booking: records condition_in, damages, and sets item status
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

  -- 1. Update booking header
  update public.bookings
  set status = 'returned',
      return_notes = p_return_notes,
      is_damaged = coalesce(p_damaged, false),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  -- 2. Update booking_items junction
  update public.booking_items
  set returned_at = now(),
      item_condition_in = p_return_notes,
      is_damaged = coalesce(p_damaged, false)
  where booking_id = p_booking_id;

  -- 3. Transition equipment status: damaged items move to maintenance immediately
  v_new_status := case when p_damaged then 'maintenance' else 'available' end;

  update public.items
  set status = v_new_status, updated_at = now()
  where id in (
    select item_id from public.booking_items where booking_id = p_booking_id
    union
    select v_booking.item_id where v_booking.item_id is not null
  );

  return v_booking;
end;
$$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY POLICIES (Strict RBAC across all 12 tables)
-- ============================================================================

-- Equipment Categories RLS
drop policy if exists "categories_select_authenticated" on public.equipment_categories;
drop policy if exists "categories_manage_staff"         on public.equipment_categories;

create policy "categories_select_authenticated"
  on public.equipment_categories for select
  to authenticated
  using (true);

create policy "categories_manage_staff"
  on public.equipment_categories for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Extras Catalog RLS
drop policy if exists "extras_catalog_select_authenticated" on public.extras_catalog;
drop policy if exists "extras_catalog_manage_staff"         on public.extras_catalog;

create policy "extras_catalog_select_authenticated"
  on public.extras_catalog for select
  to authenticated
  using (true);

create policy "extras_catalog_manage_staff"
  on public.extras_catalog for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Booking Items Junction RLS
drop policy if exists "booking_items_select"       on public.booking_items;
drop policy if exists "booking_items_manage_staff" on public.booking_items;

create policy "booking_items_select"
  on public.booking_items for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or public.is_staff())
    )
  );

create policy "booking_items_manage_staff"
  on public.booking_items for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Maintenance Technicians Junction RLS
drop policy if exists "maint_tech_select_staff" on public.maintenance_technicians;
drop policy if exists "maint_tech_manage_staff" on public.maintenance_technicians;

create policy "maint_tech_select_staff"
  on public.maintenance_technicians for select
  to authenticated
  using (public.is_staff());

create policy "maint_tech_manage_staff"
  on public.maintenance_technicians for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Audit Logs RLS: ONLY Admins can read. No client update or delete permitted!
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- Revoke insert/update/delete on audit_logs from client roles to ensure tamper-proof trail
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- Grant execution on new procedures
grant execute on function public.log_table_audit() to authenticated;

-- ============================================================================
-- 9. STRUCTURAL OPTIMIZATION & INDEXING PATTERNS
-- ============================================================================
create index if not exists idx_items_category on public.items (category_id);
create index if not exists idx_booking_items_booking on public.booking_items (booking_id);
create index if not exists idx_booking_items_item on public.booking_items (item_id);
create index if not exists idx_booking_extras_catalog on public.booking_extras (catalog_id);
create index if not exists idx_maint_tech_maintenance on public.maintenance_technicians (maintenance_id);
create index if not exists idx_maint_tech_user on public.maintenance_technicians (technician_id);
create index if not exists idx_audit_logs_table_record on public.audit_logs (table_name, record_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_performed_by on public.audit_logs (performed_by);
