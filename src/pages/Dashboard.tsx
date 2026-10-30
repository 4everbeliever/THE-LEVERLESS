import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { FullPageLoader } from '../components/FullPageLoader'
import { HandoverSlipModal } from '../components/HandoverSlipModal'
import { NotificationBell } from '../components/NotificationBell'
import { useAdminUsers, useUpdateRole } from '../hooks/useAdminUsers'
import { authSessionKey, useAuth } from '../hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { useBookings, useCancelBooking, useCheckoutBooking, useCreateBooking, useReturnBooking } from '../hooks/useBookings'
import { useAddItem, useBranches, useItems, useResetAllItems, useUpdateItemStatus } from '../hooks/useInventory'
import { useCreateMaintenanceLog, useMaintenanceLogs } from '../hooks/useMaintenance'
import { useRecordPayment } from '../hooks/usePayments'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { isStaffRole, type AppRole } from '../types/auth'
import type { Booking, PaymentMethod, RentalItem } from '../types/rental'

export type Role = AppRole
export type Page = 'inventory' | 'bookings' | 'maintenance' | 'add' | 'users'
export type ModalType = 'auth' | 'book' | 'pay' | 'checkout' | 'return' | null
export type IconName =
  | 'grid'
  | 'calendar'
  | 'wrench'
  | 'plus'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'pin'
  | 'tag'
  | 'hash'
  | 'clock'
  | 'box'
  | 'check'
  | 'close'
  | 'card'
  | 'truck'
  | 'shield'
  | 'menu'
  | 'logout'
  | 'arrow'
  | 'alert'
  | 'users'

export const iconPaths: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7A4 4 0 0 0 12.4 9L5 16.4a2.1 2.1 0 1 0 3 3l7.4-7.4a4 4 0 0 0 5.1-5.1L18.2 9.2 15.8 7l2.3-2.3a4 4 0 0 0-3.4 1.6Z"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  tag: <><path d="M20.6 13.6 11 4H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8Z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></>,
  hash: <><path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v9l-9 5-9-5V8Z"/><path d="M12 13v9"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  truck: <><path d="M10 17h4V5H2v12h3"/><path d="M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  alert: <><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

export function Button({ children, variant = 'primary', icon, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{icon && <Icon name={icon} size={17}/>}<span>{children}</span></button>
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'field-error' : ''}`}><span className="field-label">{label}</span>{children}{error && <span className="error-text"><Icon name="alert" size={13}/>{error}</span>}</label>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props}/>
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select" {...props}/>
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  return <span className={`badge badge-${tone}`}><span className="badge-dot"/>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export const statusTone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'gray' => {
  if (['Available', 'Paid', 'Returned'].includes(status)) return 'green'
  if (['Rented out', 'Checked out'].includes(status)) return 'blue'
  if (['Maintenance', 'Reserved'].includes(status)) return 'amber'
  if (['Unpaid', 'Overdue'].includes(status)) return 'red'
  return 'gray'
}

export const roleTone = (role: Role): 'green' | 'blue' | 'amber' | 'red' | 'gray' => (role === 'admin' ? 'blue' : isStaffRole(role) ? 'amber' : 'gray')
export const roleLabels: Record<Role, string> = { customer: 'Customer', staff: 'Branch staff', admin: 'Administrator' }

export const displayName = (email: string) => (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
export const initialsOf = (email: string) => displayName(email).split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'

export function formatBookingDates(start: string, end: string) {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
    const sDay = s.getDate()
    const eDay = e.getDate()
    const year = e.getFullYear()
    if (sMonth === eMonth) {
      return `${sMonth} ${sDay}–${eDay}, ${year}`
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`
  } catch {
    return `${start} – ${end}`
  }
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><span className="logo-mark"><Icon name="wrench" size={19}/></span>{!compact && <span>Toolshed<span> Rentals</span></span>}</div>
}

export function Sidebar({
  page,
  setPage,
  role,
  currentBranch = 'Tagbilaran City',
  onSwitchBranch,
}: {
  page: Page
  setPage: (page: Page) => void
  role: Role
  currentBranch?: string
  onSwitchBranch?: () => void
}) {
  const links: { id: Page; label: string; icon: IconName }[] = [
    { id: 'inventory', label: 'Dashboard & items', icon: 'grid' },
    { id: 'bookings', label: isStaffRole(role) ? 'All bookings' : 'My bookings', icon: 'calendar' },
    ...(isStaffRole(role) ? [{ id: 'maintenance' as Page, label: 'Maintenance', icon: 'wrench' as IconName }, { id: 'add' as Page, label: 'Add item', icon: 'plus' as IconName }] : []),
    ...(role === 'admin' ? [{ id: 'users' as Page, label: 'Users & roles', icon: 'users' as IconName }] : []),
  ]
  return <aside className="sidebar">
    <div className="sidebar-brand">
      <a href="/" style={{ textDecoration: 'none', color: 'inherit' }} title="Visit public intro website">
        <Logo/>
      </a>
    </div>
    <nav className="side-nav">
      <span className="nav-label">WORKSPACE</span>
      {links.map(link => <button key={link.id} className={`nav-link ${page === link.id ? 'active' : ''}`} onClick={() => setPage(link.id)}><Icon name={link.icon}/><span>{link.label}</span>{page === link.id && <span className="nav-indicator"/>}</button>)}
      <a href="/" className="nav-link" style={{ marginTop: 6, opacity: 0.85 }} title="Visit public equipment catalog">
        <Icon name="arrow"/>
        <span>View Storefront</span>
      </a>
    </nav>
    <div
      className="branch-card"
      onClick={onSwitchBranch}
      style={{ cursor: onSwitchBranch ? 'pointer' : 'default' }}
      title="Click to toggle active Bohol branch view"
    >
      <span className="branch-icon"><Icon name="pin" size={18}/></span>
      <div>
        <small>Current branch (tap to toggle)</small>
        <strong>{currentBranch}</strong>
      </div>
      <Icon name="chevron" size={14}/>
    </div>
    <div className="sidebar-footer">Toolshed Rentals<br/><span>v1.0 · Bohol, Philippines</span></div>
  </aside>
}

export function Header({ role, realRole, setRole, canPreview, email, onSignOut }: { role: Role; realRole: Role; setRole: (role: Role) => void; canPreview: boolean; email: string; onSignOut: () => void }) {
  return <header className="topbar">
    <div className="mobile-logo"><Logo compact/></div>
    <div className="topbar-spacer"/>
    <div className="kyc-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', padding: '4px 10px', borderRadius: 999 }}>
      <Icon name="shield" size={14}/>
      <span>ID Verified</span>
    </div>
    {canPreview && <div className="role-toggle" aria-label="Preview role">
      {(['customer', 'staff', 'admin'] as Role[]).map(r => <button key={r} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>{r === 'customer' ? 'Customer' : r === 'staff' ? 'Staff' : 'Admin'}</button>)}
    </div>}
    <NotificationBell />
    <button className="user-menu" onClick={onSignOut} title="Sign out" aria-label="Sign out">
      <span className="avatar">{initialsOf(email)}</span>
      <span className="user-copy"><strong>{displayName(email) || 'Account'}</strong><small>{roleLabels[realRole]}</small></span>
      <Icon name="logout" size={14}/>
    </button>
  </header>
}

function PageTitle({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div>
}

function Dashboard({ onBook, role, showToast }: { onBook: (item: RentalItem) => void; role?: Role; showToast?: (msg: string) => void }) {
  const { profile } = useProfile()
  const { data: items = [], isPending: itemsLoading, error: itemsError } = useItems()
  const { data: branches = [] } = useBranches()
  const { data: bookings = [] } = useBookings()
  const resetInventory = useResetAllItems()
  const updateItemStatus = useUpdateItemStatus()
  const firstName = displayName(profile?.email ?? '').split(' ')[0] || 'there'
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('All branches')
  const [status, setStatus] = useState('All statuses')

  const filtered = useMemo(() => items.filter(item =>
    (item.name.toLowerCase().includes(search.toLowerCase()) || item.serial.toLowerCase().includes(search.toLowerCase())) &&
    (branch === 'All branches' || item.branch === branch) &&
    (status === 'All statuses' || item.status === status)
  ), [items, search, branch, status])

  // Compute real dynamic statistics directly from database
  const stats = useMemo(() => {
    const total = items.length
    const available = items.filter(i => i.status === 'Available').length
    const rented = items.filter(i => i.status === 'Rented out').length
    const maintenance = items.filter(i => i.status === 'Maintenance').length
    const activeBookings = bookings.filter(b => ['Reserved', 'Checked out'].includes(b.status)).length
    const overdueCount = bookings.filter(b => b.is_overdue).length
    const revenueSum = bookings.filter(b => b.payment_status === 'Paid').reduce((acc, b) => acc + (b.total_amount || 0), 0)

    const availPct = total ? Math.round((available / total) * 100) : 0
    const rentedPct = total ? Math.round((rented / total) * 100) : 0
    const maintPct = total ? Math.round((maintenance / total) * 100) : 0

    return [
      ['Total items', String(total), 'box', 'All Bohol inventory'],
      ['Available', String(available), 'check', `${availPct}% ready for dispatch`],
      ['Rented out', String(rented), 'truck', `${rentedPct}% with customers`],
      ['Maintenance', String(maintenance), 'wrench', `${maintPct}% under servicing`],
      ['Active bookings', String(activeBookings), 'calendar', overdueCount > 0 ? `⚠️ ${overdueCount} overdue` : 'Active reservations'],
      ['Revenue', `₱${revenueSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'card', 'Total settled payments'],
    ] as const
  }, [items, bookings])

  return <>
    <PageTitle eyebrow="OVERVIEW" title={`Good morning, ${firstName}`} copy="Here’s what’s happening across your Bohol rental branches today."/>
    <div className="stats-grid">
      {stats.map(([label, value, icon, note], i) => <Card className="stat-card" key={label}>
        <div className={`stat-icon stat-icon-${i}`}><Icon name={icon}/></div>
        <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={i === 5 ? 'positive' : ''}>{note}</small></div>
      </Card>)}
    </div>

    {itemsError && (
      <div className="error-banner" style={{ marginBottom: 14 }}>
        <Icon name="alert"/>
        <div><strong>Failed to load inventory</strong><span>{(itemsError as Error).message}</span></div>
      </div>
    )}

    <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div><h2>Rental items</h2><p>Browse and manage equipment across all branches.</p></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="result-count">{filtered.length} items shown</span>
        {role === 'admin' && (
          <Button
            variant="secondary"
            disabled={resetInventory.isPending}
            onClick={() =>
              resetInventory.mutate(undefined, {
                onSuccess: () => showToast?.('All equipment reset to Available and active bookings released!'),
                onError: err => showToast?.(`Reset notice: ${(err as Error).message}.`),
              })
            }
          >
            {resetInventory.isPending ? 'Resetting…' : 'Make all items Available'}
          </Button>
        )}
      </div>
    </div>

    <Card className="filter-card">
      <div className="search-box">
        <Icon name="search"/>
        <input aria-label="Search items" placeholder="Search by item name or serial number..." value={search} onChange={e => setSearch(e.target.value)}/>
        {search && <button onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" size={15}/></button>}
      </div>
      <Select aria-label="Filter by branch" value={branch} onChange={e => setBranch(e.target.value)}>
        <option>All branches</option>
        {branches.length > 0 ? branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>) : (
          <>
            <option>Tagbilaran</option>
            <option>Panglao</option>
            <option>Tubigon</option>
          </>
        )}
      </Select>
      <Select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}>
        <option>All statuses</option>
        <option>Available</option>
        <option>Rented out</option>
        <option>Maintenance</option>
      </Select>
    </Card>

    {itemsLoading ? (
      <div style={{ padding: 24, fontSize: 11, textAlign: 'center', opacity: 0.7 }}>Loading equipment…</div>
    ) : filtered.length ? (
      <div className="item-grid">
        {filtered.map(item => <Card className="item-card" key={item.id}>
          <div className="item-image">
            <img src={item.image ?? 'https://images.unsplash.com/photo-1504148455328-c376907d081c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=720&h=420'} alt={item.name}/>
            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
          </div>
          <div className="item-body">
            <div className="item-title">
              <div><span>{item.category}</span><h3>{item.name}</h3></div>
              <div className="price"><strong>₱{item.price.toLocaleString()}</strong><span>/ day</span></div>
            </div>
            <div className="item-meta">
              <span><Icon name="pin" size={15}/>{item.branch}</span>
              <span><Icon name="hash" size={15}/>{item.serial}</span>
            </div>
            <Button
              variant={item.status === 'Available' ? 'primary' : 'secondary'}
              disabled={item.status !== 'Available'}
              onClick={() => onBook(item)}
            >
              {item.status === 'Available' ? 'Book this item' : item.status === 'Maintenance' ? 'Under maintenance' : 'Currently rented'}
            </Button>
            {role && isStaffRole(role) && item.status !== 'Available' && (
              <Button
                variant="ghost"
                style={{ marginTop: 6, fontSize: 11 }}
                onClick={() =>
                  updateItemStatus.mutate(
                    { id: item.id, status: 'available' },
                    {
                      onSuccess: () => showToast?.(`${item.name} is now Available!`),
                      onError: err => showToast?.(`Failed: ${(err as Error).message}`),
                    }
                  )
                }
              >
                Mark Available
              </Button>
            )}
          </div>
        </Card>)}
      </div>
    ) : (
      <EmptyState
        title="No equipment found"
        copy={search || branch !== 'All branches' || status !== 'All statuses' ? 'Try adjusting your search filters.' : 'No tools registered in this branch yet.'}
        action={search || branch !== 'All branches' || status !== 'All statuses' ? <Button variant="secondary" onClick={() => { setSearch(''); setBranch('All branches'); setStatus('All statuses') }}>Clear filters</Button> : undefined}
      />
    )}
  </>
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <Card className="empty-state"><span className="empty-icon"><Icon name="search" size={24}/></span><h3>{title}</h3><p>{copy}</p>{action}</Card>
}

function Bookings({
  role,
  openModal,
  onViewSlip,
  showToast,
}: {
  role: Role
  openModal: (type: ModalType, booking?: Booking) => void
  onViewSlip: (booking: Booking) => void
  showToast?: (msg: string) => void
}) {
  const { data: bookings = [], isPending, error } = useBookings()
  const cancelBooking = useCancelBooking()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')

  const filtered = useMemo(() => bookings.filter(b => {
    const matchesSearch = b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.item_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All statuses' || b.status === statusFilter
    return matchesSearch && matchesStatus
  }), [bookings, search, statusFilter])

  return <>
    <PageTitle
      eyebrow="RENTAL ACTIVITY"
      title={isStaffRole(role) ? 'All bookings' : 'My bookings'}
      copy={isStaffRole(role) ? 'Review and manage every rental from reservation to return.' : 'Track your reservations, payments, and rental history.'}
      action={<Button icon="plus" onClick={() => openModal('book')}>New booking</Button>}
    />

    {error && (
      <div className="error-banner" style={{ marginBottom: 14 }}>
        <Icon name="alert"/>
        <div><strong>Failed to load bookings</strong><span>{(error as Error).message}</span></div>
      </div>
    )}

    <Card className="table-card">
      <div className="table-toolbar">
        <div className="search-box compact">
          <Icon name="search"/>
          <input
            placeholder="Search bookings..."
            aria-label="Search bookings"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select aria-label="Booking status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All statuses</option>
          <option>Reserved</option>
          <option>Checked out</option>
          <option>Returned</option>
          <option>Cancelled</option>
        </Select>
      </div>

      {isPending ? (
        <div style={{ padding: 24, fontSize: 11, textAlign: 'center', opacity: 0.7 }}>Loading bookings…</div>
      ) : filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Item</th>
                {isStaffRole(role) && <th>Customer</th>}
                <th>Rental dates</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(booking => (
                <tr key={booking.id}>
                  <td>
                    <strong>{booking.id}</strong>
                    {booking.is_overdue && (
                      <span style={{ display: 'block', fontSize: 9, color: 'var(--red)', fontWeight: 800, marginTop: 2 }}>
                        ⚠️ OVERDUE
                      </span>
                    )}
                  </td>
                  <td>{booking.item_name}</td>
                  {isStaffRole(role) && <td>{booking.customer_name || 'Customer'}</td>}
                  <td>{formatBookingDates(booking.start_date, booking.end_date)}</td>
                  <td>
                    <Badge tone={booking.is_overdue ? 'red' : statusTone(booking.status)}>
                      {booking.is_overdue ? 'Overdue' : booking.status}
                    </Badge>
                  </td>
                  <td><Badge tone={statusTone(booking.payment_status)}>{booking.payment_status}</Badge></td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" onClick={() => onViewSlip(booking)} title="Print handover slip and official receipt">
                        Slip
                      </Button>
                      {booking.payment_status === 'Unpaid' && (
                        <Button variant="secondary" onClick={() => openModal('pay', booking)}>Pay</Button>
                      )}
                      {booking.status === 'Reserved' && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            cancelBooking.mutate(booking.id, {
                              onSuccess: () => showToast?.(`Booking ${booking.id} cancelled. Item released.`),
                              onError: err => showToast?.(`Failed to cancel: ${(err as Error).message}`),
                            })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                      {isStaffRole(role) && booking.status === 'Reserved' && (
                        <Button variant="secondary" onClick={() => openModal('checkout', booking)}>Check out</Button>
                      )}
                      {isStaffRole(role) && booking.status === 'Checked out' && (
                        <Button variant="secondary" onClick={() => openModal('return', booking)}>Return</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No bookings found"
          copy={search || statusFilter !== 'All statuses' ? 'Try changing your search or status filter.' : 'Book an item from the inventory to get started.'}
          action={search || statusFilter !== 'All statuses' ? <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('All statuses') }}>Clear filters</Button> : undefined}
        />
      )}
      <div className="table-footer"><span>Showing {filtered.length} of {bookings.length} bookings</span></div>
    </Card>
  </>
}

function Maintenance() {
  const { data: items = [] } = useItems()
  const { data: logs = [], isPending: logsLoading, error: logsError } = useMaintenanceLogs()
  const createLog = useCreateMaintenanceLog()
  const [selectedItemId, setSelectedItemId] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('1')
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItemId) return

    createLog.mutate(
      {
        itemId: selectedItemId,
        description,
        hoursSpent: Number(hours) || 0,
        performedAt,
      },
      {
        onSuccess: () => {
          setSelectedItemId('')
          setDescription('')
          setHours('1')
        },
      }
    )
  }

  return <>
    <PageTitle eyebrow="SERVICE & REPAIR" title="Equipment maintenance" copy="Record servicing, part replacements, and inspection sign-offs."/>
    <div className="maintenance-layout">
      <Card className="form-card">
        <div className="form-intro">
          <span className="large-title-icon"><Icon name="wrench" size={27}/></span>
          <div><h2>Log service event</h2><p>Track labor and condition updates for any tool in the Bohol fleet.</p></div>
        </div>

        {createLog.isError && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="alert"/>
            <div><strong>Could not save log</strong><span>{(createLog.error as Error).message}</span></div>
          </div>
        )}

        <form onSubmit={submit} className="form-stack">
          <Field label="Rental item">
            <Select required value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
              <option value="">Select an item</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} · {i.serial}</option>)}
            </Select>
          </Field>
          <Field label="Description">
            <textarea
              className="input textarea"
              placeholder="Describe the issue, work performed, or parts replaced..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </Field>
          <div className="field-row">
            <Field label="Hours spent">
              <Input type="number" min="0" step="0.5" placeholder="0" value={hours} onChange={e => setHours(e.target.value)}/>
            </Field>
            <Field label="Performed at">
              <Input type="date" value={performedAt} onChange={e => setPerformedAt(e.target.value)} required/>
            </Field>
          </div>
          <Button type="submit" disabled={createLog.isPending}>
            {createLog.isPending ? 'Saving log…' : 'Save maintenance log'}
          </Button>
        </form>
      </Card>

      <Card className="history-card">
        <div className="section-heading inner">
          <div><h2>Maintenance history</h2><p>Recent logs across all Bohol branches.</p></div>
        </div>

        {logsError && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="alert"/>
            <div><strong>Failed to load history</strong><span>{(logsError as Error).message}</span></div>
          </div>
        )}

        {logsLoading ? (
          <div style={{ padding: 24, fontSize: 11, textAlign: 'center', opacity: 0.7 }}>Loading maintenance history…</div>
        ) : logs.length ? (
          <div className="history-list">
            {logs.map(log => (
              <div className="history-item" key={log.id}>
                <span className="timeline-dot"/>
                <div>
                  <strong>{log.items?.name ?? 'Equipment'}</strong>
                  <p>{log.description}</p>
                  <span>{new Date(log.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {log.staff_name || 'Staff'}</span>
                </div>
                <Badge tone="green">{log.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No maintenance logs" copy="Logs will appear here once maintenance is recorded."/>
        )}
      </Card>
    </div>
  </>
}

function AddItem({ done }: { done: () => void }) {
  const { data: branches = [] } = useBranches()
  const addItem = useAddItem()
  const [error, setError] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') || '').trim()
    const serial = String(form.get('serial') || '').trim()
    const category = String(form.get('category') || '').trim()
    const branch = String(form.get('branch') || '').trim()

    if (!serial) {
      setError('A unique serial number is required.')
      return
    }

    addItem.mutate(
      { name, serial, category, branch },
      {
        onSuccess: () => done(),
        onError: err => setError((err as Error).message || 'Failed to add item.'),
      }
    )
  }

  return <>
    <PageTitle eyebrow="INVENTORY" title="Add a new item" copy="Register equipment and assign it to a branch."/>
    <Card className="add-item-card">
      <div className="form-intro">
        <span className="large-title-icon"><Icon name="box" size={27}/></span>
        <div><h2>Item details</h2><p>Enter the equipment information exactly as it appears on the asset tag.</p></div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 14 }}>
          <Icon name="alert"/>
          <div><strong>Could not add item</strong><span>{error}</span></div>
        </div>
      )}

      <form onSubmit={submit} className="add-form">
        <Field label="Item name"><Input name="name" placeholder="e.g. Makita Cordless Drill" required/></Field>
        <Field label="Serial number" error={error ? error : undefined}><Input name="serial" placeholder="e.g. MKD-2025-0183" required/></Field>
        <Field label="Category">
          <Select name="category" required defaultValue="">
            <option value="" disabled>Select a category</option>
            <option>Power tools</option>
            <option>Cutting tools</option>
            <option>Heavy equipment</option>
            <option>Demolition</option>
          </Select>
        </Field>
        <Field label="Branch">
          <Select name="branch" required defaultValue="">
            <option value="" disabled>Select a branch</option>
            {branches.length > 0 ? branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>) : (
              <>
                <option>Tagbilaran</option>
                <option>Panglao</option>
                <option>Tubigon</option>
              </>
            )}
          </Select>
        </Field>
        <div className="form-divider"/>
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={done}>Cancel</Button>
          <Button type="submit" disabled={addItem.isPending}>
            {addItem.isPending ? 'Adding item…' : 'Add item to inventory'}
          </Button>
        </div>
      </form>
    </Card>
  </>
}

export function UsersPanel({ currentUserId }: { currentUserId?: string }) {
  const { data: users, isPending, error } = useAdminUsers(true)
  const updateRole = useUpdateRole()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => (users ?? []).filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) &&
    (roleFilter === 'All roles' || u.role === roleFilter)
  ), [users, search, roleFilter])

  const change = (id: string, email: string, role: Role) => updateRole.mutate({ id, role }, {
    onSuccess: () => { setNotice(`${email} is now ${roleLabels[role].toLowerCase()}.`); window.setTimeout(() => setNotice(''), 3000) },
  })

  return <>
    <PageTitle eyebrow="ADMINISTRATION" title="Users & roles" copy="Control who can rent, run the counter, or manage the whole system."/>
    {notice && <div className="success-banner"><Icon name="check"/>{notice}</div>}
    {updateRole.error && <div className="error-banner" style={{ marginBottom: 14 }}><Icon name="alert"/><div><strong>Role was not changed</strong><span>{(updateRole.error as Error).message}</span></div></div>}
    {error && <div className="error-banner" style={{ marginBottom: 14 }}><Icon name="alert"/><div><strong>We couldn’t load the users</strong><span>{(error as Error).message}</span></div></div>}
    <Card className="table-card">
      <div className="table-toolbar">
        <div className="search-box compact"><Icon name="search"/><input placeholder="Search by email..." aria-label="Search users" value={search} onChange={e => setSearch(e.target.value)}/></div>
        <Select aria-label="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option>All roles</option><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></Select>
      </div>
      {isPending ? <div style={{ padding: 24, fontSize: 11 }}>Loading users…</div> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>Email</th><th>Current role</th><th>Change role</th><th>Joined</th></tr></thead>
      <tbody>{filtered.map(u => {
        const isSelf = u.id === currentUserId
        const saving = updateRole.isPending && updateRole.variables?.id === u.id
        return <tr key={u.id}>
          <td><strong>{u.email}</strong>{isSelf && <small style={{ marginLeft: 8, opacity: .6 }}>(you)</small>}</td>
          <td><Badge tone={roleTone(u.role)}>{roleLabels[u.role]}</Badge></td>
          <td><Select aria-label={`Role for ${u.email}`} value={u.role} disabled={isSelf || saving} title={isSelf ? 'You cannot change your own role' : undefined} onChange={e => change(u.id, u.email, e.target.value as Role)} style={{ width: 150, minHeight: 34 }}><option value="customer">Customer</option><option value="staff">Branch staff</option><option value="admin">Administrator</option></Select></td>
          <td>{new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>
      })}</tbody></table></div> : <EmptyState title="No users found" copy="Try a different search or role filter."/>}
      <div className="table-footer"><span>Showing {filtered.length} of {users?.length ?? 0} users</span></div>
    </Card>
  </>
}

function Modal({
  type,
  close,
  selectedItem,
  selectedBooking,
  onSuccess,
}: {
  type: ModalType
  close: () => void
  selectedItem: RentalItem | null
  selectedBooking: Booking | null
  onSuccess: (msg: string) => void
}) {
  const [delivery, setDelivery] = useState(true)
  const [insurance, setInsurance] = useState(false)
  const [damaged, setDamaged] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GCash')
  const [refNumber, setRefNumber] = useState('')
  const [conditionNotes, setConditionNotes] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [modalError, setModalError] = useState('')

  // Dates for booking modal
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [])

  const defaultEnd = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 4)
    d.setHours(17, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [])

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)

  const createBooking = useCreateBooking()
  const recordPayment = useRecordPayment()
  const checkoutBooking = useCheckoutBooking()
  const returnBooking = useReturnBooking()

  if (!type) return null

  // Calculate rental estimate dynamically
  const dailyRate = selectedItem?.price ?? 450
  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
  const subtotal = days * dailyRate
  const deliveryFee = delivery ? 350 : 0
  const insuranceFee = insurance ? 85 * days : 0
  const estimatedTotal = subtotal + deliveryFee + insuranceFee

  const titles: Record<Exclude<ModalType, null>, [string, string]> = {
    auth: ['Account Access', 'Please use the login page to access your profile.'],
    book: ['Book this item', selectedItem ? `${selectedItem.name} · ₱${selectedItem.price}/day` : 'Equipment Reservation'],
    pay: ['Record Payment', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'Rental Payment Settlement'],
    checkout: ['Check out item', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'Equipment Release'],
    return: ['Return item', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'Equipment Check-in'],
  }

  const confirm = (e: FormEvent) => {
    e.preventDefault()
    setModalError('')

    if (type === 'auth') {
      close()
      return
    }

    if (type === 'book') {
      if (!selectedItem) {
        setModalError('No item selected.')
        return
      }
      createBooking.mutate(
        {
          itemId: selectedItem.id,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          delivery,
          insurance,
        },
        {
          onSuccess: b => {
            close()
            onSuccess(`Booking ${b.id} reserved successfully!`)
          },
          onError: err => {
            setModalError((err as Error).message || 'Failed to create booking.')
          },
        }
      )
      return
    }

    if (type === 'pay') {
      if (!selectedBooking) {
        setModalError('No booking selected.')
        return
      }
      if (paymentMethod === 'GCash' && (!refNumber || refNumber.trim().length < 8)) {
        setModalError('Please enter a valid GCash reference number (minimum 8 digits).')
        return
      }
      recordPayment.mutate(
        {
          bookingId: selectedBooking.id,
          amount: selectedBooking.total_amount || 1140,
          paymentMethod,
          referenceNumber: refNumber ? refNumber.trim() : undefined,
        },
        {
          onSuccess: () => {
            close()
            onSuccess(`Payment verified and recorded for booking ${selectedBooking.id}!`)
          },
          onError: err => {
            setModalError((err as Error).message || 'Failed to record payment.')
          },
        }
      )
      return
    }

    if (type === 'checkout') {
      if (!selectedBooking) {
        setModalError('No booking selected.')
        return
      }
      checkoutBooking.mutate(
        {
          id: selectedBooking.id,
          conditionNotes,
        },
        {
          onSuccess: () => {
            close()
            onSuccess(`Item checked out for booking ${selectedBooking.id}!`)
          },
          onError: err => {
            setModalError((err as Error).message || 'Failed to check out item.')
          },
        }
      )
      return
    }

    if (type === 'return') {
      if (!selectedBooking) {
        setModalError('No booking selected.')
        return
      }
      returnBooking.mutate(
        {
          id: selectedBooking.id,
          returnNotes,
          isDamaged: damaged,
        },
        {
          onSuccess: () => {
            close()
            onSuccess(`Item returned for booking ${selectedBooking.id}! Refundable deposit released.`)
          },
          onError: err => {
            setModalError((err as Error).message || 'Failed to complete return.')
          },
        }
      )
      return
    }
  }

  const isSubmitting = createBooking.isPending || recordPayment.isPending || checkoutBooking.isPending || returnBooking.isPending

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-header">
        <div>
          <h2>{titles[type][0]}</h2>
          <p>{titles[type][1]}</p>
        </div>
        <button className="close-button" onClick={close} aria-label="Close"><Icon name="close"/></button>
      </div>

      {modalError && (
        <div className="error-banner" style={{ margin: '0 24px 12px' }}>
          <Icon name="alert"/>
          <div><strong>Action failed</strong><span>{modalError}</span></div>
        </div>
      )}

      <form onSubmit={confirm}>
        <div className="modal-body">
          {type === 'book' && <>
            <div className="notice"><span className="notice-icon"><Icon name="calendar"/></span><div><strong>Choose your rental period</strong><span>Availability and pricing update automatically.</span></div></div>
            <div className="field-row">
              <Field label="Start date & time">
                <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required/>
              </Field>
              <Field label="End date & time">
                <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required/>
              </Field>
            </div>
            <div className="extras-title"><span>Optional extras</span><small>Select equipment services</small></div>
            <Extra icon="truck" title="Site Delivery" copy="Bohol jobsite drop-off and collection" price="₱350" checked={delivery} onChange={setDelivery}/>
            <Extra icon="shield" title="Damage Waiver" copy="Covers accidental wear per day" price="₱85" checked={insurance} onChange={setInsurance}/>
            <div className="estimate">
              <div><span>{days} {days === 1 ? 'day' : 'days'} × ₱{dailyRate.toLocaleString()}</span><strong>₱{subtotal.toLocaleString()}</strong></div>
              {delivery && <div><span>Site Delivery</span><strong>₱350</strong></div>}
              {insurance && <div><span>Damage Waiver</span><strong>₱{insuranceFee.toLocaleString()}</strong></div>}
              <div style={{ color: 'var(--green)', borderTop: '1px dashed #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                <span>Refundable Security Deposit (Returned on safe check-in)</span>
                <strong>₱1,000</strong>
              </div>
              <div className="estimate-total"><span>Estimated Total Rental Fee</span><strong>₱{estimatedTotal.toLocaleString()}</strong></div>
              <small>KYC Status: ✓ Government ID Verified · Standard Bohol handover agreement applies.</small>
            </div>
          </>}

          {type === 'pay' && <>
            <div className="payment-summary">
              <span>Amount due</span>
              <strong>₱{(selectedBooking?.total_amount || 1140).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              <small>Booking {selectedBooking?.id}</small>
            </div>
            <span className="field-label standalone">Payment method</span>
            <div className="payment-grid">
              {(['Cash','GCash','Card','Bank transfer'] as PaymentMethod[]).map(method => (
                <button
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`payment-option ${paymentMethod === method ? 'active' : ''}`}
                  key={method}
                >
                  <Icon name={method === 'Cash' ? 'card' : method === 'GCash' ? 'clock' : method === 'Card' ? 'card' : 'arrow'}/>
                  <span>{method}</span>
                  {paymentMethod === method && <span className="option-check"><Icon name="check" size={12}/></span>}
                </button>
              ))}
            </div>

            {paymentMethod === 'GCash' && (
              <div className="gcash-payment-box">
                <div className="gcash-badge-row">
                  <span className="gcash-pill-badge">GCash QR Ph</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#007dfe' }}>Bohol Central Dispatch</span>
                </div>
                <div className="gcash-account-info">
                  <strong>Account: 0917-882-TOOL (8665)</strong>
                  <small>Merchant Name: TOOLSHED RENTALS BOHOL</small>
                </div>
                <Field label="13-digit GCash Reference Number">
                  <Input
                    placeholder="e.g. 2004 8912 3410"
                    value={refNumber}
                    onChange={e => setRefNumber(e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}

            {paymentMethod === 'Bank transfer' && (
              <div className="gcash-payment-box" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                <div className="gcash-account-info">
                  <strong>BDO Bohol Central: 0041-8802-9912</strong>
                  <small>Account Name: Toolshed Rentals Bohol Inc.</small>
                </div>
                <Field label="Bank Transfer Reference / Deposit Code">
                  <Input
                    placeholder="e.g. BDO-TR-992140"
                    value={refNumber}
                    onChange={e => setRefNumber(e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}
          </>}

          {type === 'checkout' && <>
            <div className="notice"><span className="notice-icon"><Icon name="check"/></span><div><strong>Ready for handover</strong><span>Confirm the tool’s condition and accessories before releasing it.</span></div></div>
            <Field label="Condition notes">
              <textarea
                className="input textarea"
                placeholder="Note the current condition, included parts, and accessories..."
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                required
              />
            </Field>
          </>}

          {type === 'return' && <>
            <Field label="Return notes">
              <textarea
                className="input textarea"
                placeholder="Note returned parts, cleanliness, and wear..."
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                required
              />
            </Field>
            <label className="checkbox-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={damaged}
                onChange={e => setDamaged(e.target.checked)}
              />
              <span style={{ fontSize: 13, color: damaged ? 'var(--red)' : 'inherit', fontWeight: damaged ? 700 : 500 }}>
                Equipment requires servicing or sustained damage (transitions to Maintenance)
              </span>
            </label>
          </>}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" type="button" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : type === 'book' ? 'Confirm Reservation' : type === 'pay' ? 'Record Payment' : type === 'checkout' ? 'Release Equipment' : 'Complete Return'}
          </Button>
        </div>
      </form>
    </div>
  </div>
}

function Extra({ icon, title, copy, price, checked, onChange }: { icon: IconName; title: string; copy: string; price: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="extra-row">
    <div className="extra-info"><span className="extra-icon"><Icon name={icon}/></span><div><strong>{title}</strong><p>{copy}</p></div></div>
    <div className="extra-action"><span className="extra-price">{price}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/></div>
  </div>
}

function MobileNav({ page, setPage, role }: { page: Page; setPage: (p: Page) => void; role: Role }) {
  const links = [
    { id: 'inventory' as Page, label: 'Home', icon: 'grid' as IconName },
    { id: 'bookings' as Page, label: 'Bookings', icon: 'calendar' as IconName },
    ...(isStaffRole(role) ? [{ id: 'maintenance' as Page, label: 'Service', icon: 'wrench' as IconName }, { id: 'add' as Page, label: 'Add item', icon: 'plus' as IconName }] : []),
    ...(role === 'admin' ? [{ id: 'users' as Page, label: 'Users', icon: 'users' as IconName }] : []),
  ]
  return <nav className="mobile-nav">{links.map(link => <button className={page === link.id ? 'active' : ''} onClick={() => setPage(link.id)} key={link.id}><Icon name={link.icon}/><span>{link.label}</span></button>)}</nav>
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { profile, role: realRole, isAdmin, isPending, error: profileError } = useProfile()
  const [previewRole, setPreviewRole] = useState<Role | null>(null)
  const role: Role = isAdmin && previewRole ? previewRole : realRole
  const [page, setPage] = useState<Page>('inventory')
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [viewingSlipBooking, setViewingSlipBooking] = useState<Booking | null>(null)
  const [toast, setToast] = useState('')

  // Branch switcher state
  const branchesList = ['Tagbilaran City', 'Panglao', 'Tubigon', 'All Bohol Branches']
  const [branchIndex, setBranchIndex] = useState(0)
  const currentBranch = branchesList[branchIndex]

  const switchBranch = () => {
    setBranchIndex(prev => (prev + 1) % branchesList.length)
  }

  const { data: items = [] } = useItems()

  // Support ?book=<itemId> query parameter from public storefront
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bookItemId = params.get('book')
    if (bookItemId && items.length > 0) {
      const match = items.find(i => i.id === bookItemId)
      if (match) {
        setSelectedItem(match)
        setSelectedBooking(null)
        setModal('book')
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [items])

  const changeRole = (next: Role) => {
    setPreviewRole(next)
    if ((!isStaffRole(next) && ['maintenance', 'add'].includes(page)) || (next !== 'admin' && page === 'users')) {
      setPage('inventory')
    }
  }

  const signOut = async () => {
    navigate('/', { replace: true })
    queryClient.setQueryData(authSessionKey, null)
    queryClient.clear()
    await supabase.auth.signOut()
  }

  const bookItem = (item: RentalItem) => {
    setSelectedItem(item)
    setSelectedBooking(null)
    setModal('book')
  }

  const openBookingModal = (type: ModalType, booking?: Booking) => {
    setSelectedBooking(booking ?? null)
    if (type === 'book') {
      const avail = items.find(i => i.status === 'Available') ?? items[0] ?? null
      setSelectedItem(avail)
    }
    setModal(type)
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  const completedAdd = () => {
    setPage('inventory')
    showToast('Item registered in Bohol inventory')
  }

  if (isPending) return <FullPageLoader/>

  return <div className="app-shell">
    <Sidebar
      page={page}
      setPage={setPage}
      role={role}
      currentBranch={currentBranch}
      onSwitchBranch={switchBranch}
    />
    <div className="app-main">
      <Header role={role} realRole={realRole} setRole={changeRole} canPreview={isAdmin} email={profile?.email ?? user?.email ?? ''} onSignOut={signOut}/>
      <main className="content">
        {profileError && (
          <div className="warning-banner" style={{ marginBottom: 18 }}>
            <Icon name="alert"/>
            <span>Roles are not set up yet, so you are seeing the customer view. Run supabase/migrations/0001_profiles_and_roles.sql in Supabase.</span>
          </div>
        )}
        {page === 'inventory' && <Dashboard onBook={bookItem} role={role} showToast={showToast} />}
        {page === 'bookings' && (
          <Bookings
            role={role}
            openModal={openBookingModal}
            onViewSlip={b => setViewingSlipBooking(b)}
            showToast={showToast}
          />
        )}
        {page === 'maintenance' && isStaffRole(role) && <Maintenance/>}
        {page === 'add' && isStaffRole(role) && <AddItem done={completedAdd}/>}
        {page === 'users' && role === 'admin' && <UsersPanel currentUserId={profile?.id}/>}
      </main>
    </div>
    <MobileNav page={page} setPage={setPage} role={role}/>
    <Modal
      type={modal}
      close={() => setModal(null)}
      selectedItem={selectedItem}
      selectedBooking={selectedBooking}
      onSuccess={showToast}
    />
    <HandoverSlipModal
      booking={viewingSlipBooking}
      onClose={() => setViewingSlipBooking(null)}
    />
    {toast && <div className="toast"><span><Icon name="check"/></span>{toast}</div>}
  </div>
}
