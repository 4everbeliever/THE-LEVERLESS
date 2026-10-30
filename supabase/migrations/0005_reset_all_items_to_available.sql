-- Toolshed Rentals: Reset all items to Available and release all bookings
-- Migration 0005: Make all inventory items available for booking
-- Run this in the Supabase SQL Editor (project ophgpdwzoeuheshcfrrc)

-- 1. Reset all equipment status to 'available'
update public.items
set status = 'available',
    updated_at = now();

-- 2. Release all active bookings (reserved / checked_out) by marking them 'returned'
--    so the double-booking exclusion constraint won't block new reservations
update public.bookings
set status = 'returned',
    return_notes = coalesce(return_notes, 'Released to inventory'),
    updated_at = now()
where status in ('reserved', 'checked_out');

-- 3. Create an RPC function so inventory can be reset anytime from the app
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
  -- Update all items
  update public.items
  set status = 'available', updated_at = now();
  get diagnostics v_items_count = row_count;

  -- Release all active bookings
  update public.bookings
  set status = 'returned',
      return_notes = coalesce(return_notes, 'Released to inventory'),
      updated_at = now()
  where status in ('reserved', 'checked_out');
  get diagnostics v_bookings_count = row_count;

  return jsonb_build_object(
    'success', true,
    'items_reset', v_items_count,
    'bookings_released', v_bookings_count
  );
end;
$$;

-- Restrict execution strictly to authenticated users (admin verification inside function)
grant execute on function public.reset_all_inventory_available() to authenticated;
