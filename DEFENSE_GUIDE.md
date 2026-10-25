# Toolshed Rentals — Live Q&A Defense & Architectural Stress-Test Guide

**Course:** Advanced Database Systems (3rd Year IT Finals Block)  
**Document Target:** Section VIII — Architectural Audit & Defense Blueprint  

This guide provides the exact technical script, operational answers, and line-by-line code explanations required during the live defense examination with your instructor.

---

## Defense Part 1: The Architectural "What-If" Stress Test

### Scenario A: Instructor manually deletes a parent row in the database client
> **Instructor:** *"I am opening your database management client right now and manually deleting a parent row. Show me how your framework's relational constraints handle this mutation without throwing an unhandled backend crash."*

#### Your Technical Response:
> *"Our schema enforces strict declarative referential integrity constraints (`ON DELETE RESTRICT` and `ON DELETE CASCADE`) specifically designed to prevent orphan data and handle parent mutations deterministically without crashing."*

#### The Walkthrough (Demonstrating in SQL Editor):
1. **Case 1: Deleting a Branch that has equipment attached (`ON DELETE RESTRICT`)**
   ```sql
   -- Instructor attempts:
   DELETE FROM public.branches WHERE name = 'Tagbilaran';
   ```
   - **Postgres Engine Behavior:** The database rejects the mutation with SQL Error `23503` (`foreign_key_violation`):  
     `update or delete on table "branches" violates foreign key constraint "items_branch_id_fkey" on table "items"`.
   - **Application Behavior:** The React UI / TanStack Query error boundary catches the 409/400 response from PostgREST and renders a clean toast: *"Cannot delete this branch because active equipment is registered to it."* No unhandled backend crash occurs.

2. **Case 2: Deleting an Item with past/active bookings (`ON DELETE RESTRICT`)**
   ```sql
   DELETE FROM public.items WHERE serial = 'MKD-2024-0182';
   ```
   - **Postgres Engine Behavior:** Blocked by `ON DELETE RESTRICT` on `bookings.item_id` and `booking_items.item_id`.
   - **Data Cohesion:** Guarantees that historical customer financial records and booking contracts never lose their relational asset target.

3. **Case 3: Deleting a Booking (`ON DELETE CASCADE`)**
   ```sql
   DELETE FROM public.bookings WHERE id = 'BK-2050';
   ```
   - **Postgres Engine Behavior:** Deleting the parent booking automatically and cleanly cascades to `booking_items`, `booking_extras`, and `payments`. No orphaned payment records or line items remain in the database.
   - **Automated Audit Trigger:** The `trg_audit_bookings` trigger fires `AFTER DELETE`, writing an immutable JSON snapshot of the deleted booking into `public.audit_logs` before the transaction commits.

---

### Scenario B: Database Connection & Root Credential Audit
> **Instructor:** *"Show me your database connection string file. If I look at your production environment variables (.env), how have you restricted your application's connection permissions so it doesn't run on administrative root privileges?"*

#### Your Technical Response:
> *"Open `.env.local` or `.env.example`. You will observe that our application does NOT possess the database root password, the postgres superuser connection string, or the Supabase `service_role` administrative key."*

#### The Proof:
1. **Inspecting `.env.local`:**
   ```bash
   VITE_SUPABASE_URL=https://ophgpdwzoeuheshcfrrc.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
2. **Key Architectural Safeguards:**
   - **Least Privilege Principle:** The client runs strictly under the `anon` / `authenticated` PostgreSQL role via PostgREST.
   - **Database-Level RLS Enforcement:** Even if someone extracts the `VITE_SUPABASE_ANON_KEY` from the browser bundle, they have zero root permissions. All queries are evaluated against Row Level Security policies:
     - Customers can only read and mutate rows where `customer_id = auth.uid()`.
     - Non-admin users cannot alter user roles because `public.protect_role_change()` and `public.is_admin()` reject unauthorized role elevation at the database engine level.
   - **Privileged Secrets Isolation:** The `service_role` key is strictly restricted to secure Supabase Edge Function secrets and is never bundled in frontend code.

---

## Defense Part 2: The Individual Execution Defense (Line-by-Line Code Explanation)

> **Instructor:** *"Explain the exact data lifecycle that occurs between the client trigger, the framework's middleware router, and this server-side database transaction block. Walk me through the variables line-by-line."*

### Focus Procedure: `public.create_booking(p_item_id, p_start_at, p_end_at, p_extras)`

#### 1. Client Trigger & Transport Layer
- **Client Trigger:** The user selects dates on the UI and clicks "Confirm Booking".
- **Form Validation:** React Hook Form and Zod validate the dates and required fields on the client.
- **Client Dispatch:** [src/hooks/useBookings.ts](file:///c:/Users/rj/Downloads/toolshed-rentals-with-admin/toolshed-rentals/src/hooks/useBookings.ts) invokes `supabase.rpc('create_booking', { p_item_id, p_start_at, p_end_at, p_extras })`.
- **API Transport:** PostgREST intercepts the HTTP POST request, verifies the caller's JWT in the `Authorization: Bearer <token>` header, extracts `auth.uid()`, and passes parameters as a prepared statement to the PostgreSQL stored procedure.

#### 2. Line-by-Line Database Execution (`supabase/migrations/0003_schema_expansion_and_audit.sql`)

```sql
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
```
- **Line 1–7 (`security definer`, `set search_path = public`):** Ensures the function executes with database authority to insert into locked tables while setting `search_path` to avoid search-path hijacking attacks.

```sql
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
```
- **Line 8–18:** Declares local typed variables. `v_customer_id` stores the authenticated user; `v_item` stores the equipment row; `v_rental_subtotal` and `v_extras_total` hold server-calculated currency amounts.

```sql
  v_customer_id := auth.uid();
  if v_customer_id is null then
    raise exception 'You must be signed in to book an item.';
  end if;
```
- **Line 19–23:** Verifies caller authentication. Prevents anonymous or spoofed requests.

```sql
  if p_end_at <= p_start_at then
    raise exception 'End date must be after start date.';
  end if;
```
- **Line 24–27:** Enforces business logic constraint on duration.

```sql
  select id, name, daily_price, status into v_item
  from public.items
  where id = p_item_id;

  if v_item.id is null then
    raise exception 'Rental item not found.';
  end if;

  if v_item.status in ('maintenance', 'damaged') then
    raise exception 'This item is currently undergoing maintenance and cannot be booked.';
  end if;
```
- **Line 28–38:** Queries `public.items` using the primary key index. Rejects items that are in maintenance or damaged.

```sql
  v_days := greatest(1, ceil(extract(epoch from (p_end_at - p_start_at)) / 86400)::integer);
  v_rental_subtotal := round(v_item.daily_price * v_days, 2);
```
- **Line 39–41:** **Server-Side Calculation (Critical Defense Point!):** Client input for price or days is completely ignored. The engine calculates duration from UNIX epoch difference (`/ 86400`) and multiplies by `v_item.daily_price`.

```sql
  insert into public.bookings (
    item_id, customer_id, start_at, end_at, daily_rate,
    rental_days, rental_subtotal, extras_total, total, status, payment_status
  ) values (
    p_item_id, v_customer_id, p_start_at, p_end_at, v_item.daily_price,
    v_days, v_rental_subtotal, 0, v_rental_subtotal, 'reserved', 'unpaid'
  )
  returning * into v_booking;
```
- **Line 42–54:** Inserts the header booking record. If an overlapping booking exists for the same item and dates, the `prevent_overlapping_bookings` GiST exclusion constraint raises error `23P01`, cleanly caught by the `exception` block at the end.

```sql
  insert into public.booking_items (
    booking_id, item_id, daily_rate_at_booking, quantity, item_condition_out
  ) values (
    v_booking.id, p_item_id, v_item.daily_price, 1, 'good'
  );
```
- **Line 55–63:** Inserts into the **Many-to-Many junction table `booking_items`**, recording intersection attributes: locked `daily_rate_at_booking`, quantity, and dispatch condition.

```sql
  if p_extras is not null and jsonb_array_length(p_extras) > 0 then
    for v_extra in select * from jsonb_to_recordset(p_extras) as x(extra_type text, name text, quantity integer, price numeric) loop
      v_extra_qty := greatest(1, coalesce(v_extra.quantity, 1));
      v_extra_price := coalesce(v_extra.price, 0);

      insert into public.booking_extras (booking_id, extra_type, name, quantity, price)
      values (v_booking.id, lower(v_extra.extra_type), v_extra.name, v_extra_qty, v_extra_price);

      v_extras_total := v_extras_total + (v_extra_price * v_extra_qty);
    end loop;

    update public.bookings
    set extras_total = v_extras_total,
        total = rental_subtotal + v_extras_total,
        updated_at = now()
    where id = v_booking.id
    returning * into v_booking;
  end if;
```
- **Line 64–87:** Loops through JSON array of add-ons, populating the `booking_extras` junction table and finalizing the contractual total in a single atomic database transaction.

```sql
  return v_booking;
exception
  when exclusion_violation then
    raise exception 'This item is already booked for the selected dates.' using errcode = '23P01';
end;
$$;
```
- **Line 88–94:** Catches exclusion violation from the GiST index and returns a readable, parameterized error to the client.
