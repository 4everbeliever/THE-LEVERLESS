-- Toolshed Rentals: Migration 0006 - Security Hardening, Quota Protection, and Production Integrity
-- Hardens stored procedures, prevents Denial-of-Inventory attacks, locks administrative RPCs, and adds KYC/Deposit support.
-- Safe to run multiple times in Supabase SQL Editor.

-- ============================================================================
-- 1. CRITICAL SECURITY FIX: Lock Down Inventory Reset RPC
-- ============================================================================
-- Ensure neither anonymous visitors nor normal customers can ever wipe or reset bookings.
revoke all on function public.reset_all_inventory_available() from public, anon;

create or replace function public.reset_all_inventory_available()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items_count integer;
  v_bookings_count integer;
begin
  -- Strict permission check: only verified administrators can execute this routine
  if not public.is_admin() then
    raise exception 'Access denied: Administrator privileges required to execute inventory reset.';
  end if;

  -- Reset items to available
  update public.items
  set status = 'available', updated_at = now();
  get diagnostics v_items_count = row_count;

  -- Release active bookings
  update public.bookings
  set status = 'returned',
      return_notes = coalesce(return_notes, 'Admin released to inventory'),
      updated_at = now()
  where status in ('reserved', 'checked_out');
  get diagnostics v_bookings_count = row_count;

  return jsonb_build_object(
    'success', true,
    'items_reset', v_items_count,
    'bookings_released', v_bookings_count,
    'executed_by', auth.uid()
  );
end;
$$;

grant execute on function public.reset_all_inventory_available() to authenticated;

-- ============================================================================
-- 2. HARDEN CREATE_BOOKING: Quotas & Rental Boundary Checks
-- ============================================================================
-- Prevents automated bot hoarding, Denial-of-Inventory, and invalid temporal dates.
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
  v_active_unpaid_count integer;
begin
  v_customer_id := auth.uid();
  if v_customer_id is null then
    raise exception 'You must be signed in to book an item.';
  end if;

  -- Date validations
  if p_end_at <= p_start_at then
    raise exception 'End date must be strictly after the start date.';
  end if;

  if p_start_at < (now() - interval '2 hours') then
    raise exception 'Rental start date cannot be in the past.';
  end if;

  if p_end_at > (p_start_at + interval '60 days') then
    raise exception 'Rental duration cannot exceed 60 consecutive days.';
  end if;

  -- Anti-Hoarding / Denial of Inventory Quota check:
  -- A customer cannot have more than 3 unpaid pending reservations simultaneously.
  select count(*) into v_active_unpaid_count
  from public.bookings
  where customer_id = v_customer_id
    and status = 'reserved'
    and payment_status = 'unpaid';

  if v_active_unpaid_count >= 3 then
    raise exception 'You have reached the maximum limit of 3 pending unpaid bookings. Please settle payment or cancel existing reservations first.';
  end if;

  -- Verify target item
  select id, name, daily_price, status into v_item
  from public.items
  where id = p_item_id;

  if v_item.id is null then
    raise exception 'Rental equipment not found.';
  end if;

  if v_item.status in ('maintenance', 'damaged') then
    raise exception 'This item is currently undergoing maintenance and cannot be reserved.';
  end if;

  -- Calculate rental days (minimum 1 day)
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

  -- 2. Insert into M:N junction table booking_items if table exists
  if exists (select 1 from information_schema.tables where table_name = 'booking_items' and table_schema = 'public') then
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
    )
    on conflict (booking_id, item_id) do nothing;
  end if;

  -- 3. Process optional extras
  if p_extras is not null and jsonb_array_length(p_extras) > 0 then
    for v_extra in select * from jsonb_to_recordset(p_extras) as x(extra_type text, name text, quantity integer, price numeric) loop
      v_extra_qty := greatest(1, coalesce(v_extra.quantity, 1));
      v_extra_price := coalesce(v_extra.price, 0);

      v_cat_id := null;
      if exists (select 1 from information_schema.tables where table_name = 'extras_catalog' and table_schema = 'public') then
        select id into v_cat_id
        from public.extras_catalog
        where lower(name) = lower(v_extra.name) or lower(extra_type) = lower(v_extra.extra_type)
        limit 1;
      end if;

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
        lower(coalesce(v_extra.extra_type, 'other')),
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

grant execute on function public.create_booking(uuid, timestamptz, timestamptz, jsonb) to authenticated;

-- ============================================================================
-- 3. KYC AND SECURITY DEPOSIT COLUMNS
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'verification_status'
  ) then
    alter table public.profiles
      add column verification_status text not null default 'verified'
      check (verification_status in ('unverified', 'pending_review', 'verified'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'security_deposit'
  ) then
    alter table public.bookings
      add column security_deposit numeric(10, 2) not null default 1000.00
      check (security_deposit >= 0);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'reference_number'
  ) then
    alter table public.payments
      add column reference_number text;
  end if;
end $$;

-- Update record_payment RPC to accept optional reference_number
create or replace function public.record_payment(
  p_booking_id        text,
  p_amount            numeric,
  p_method            text,
  p_reference_number  text default null
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
    reference_number,
    recorded_by
  ) values (
    p_booking_id,
    v_booking.customer_id,
    p_amount,
    lower(p_method),
    p_reference_number,
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

grant execute on function public.record_payment(text, numeric, text, text) to authenticated;

-- Backwards-compatible 3-argument overload
create or replace function public.record_payment(
  p_booking_id text,
  p_amount     numeric,
  p_method     text
)
returns public.payments
language sql
security definer
set search_path = public
as $$
  select public.record_payment(p_booking_id, p_amount, p_method, null::text);
$$;

grant execute on function public.record_payment(text, numeric, text) to authenticated;

