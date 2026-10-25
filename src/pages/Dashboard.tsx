import { FormEvent, ReactNode, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { FullPageLoader } from '../components/FullPageLoader'
import { NotificationBell } from '../components/NotificationBell'
import { useAdminUsers, useUpdateRole } from '../hooks/useAdminUsers'
import { useAuth } from '../hooks/useAuth'
import { useBookings, useCheckoutBooking, useCreateBooking, useReturnBooking } from '../hooks/useBookings'
import { useAddItem, useBranches, useItems } from '../hooks/useInventory'
import { useCreateMaintenanceLog, useMaintenanceLogs } from '../hooks/useMaintenance'
import { useRecordPayment } from '../hooks/usePayments'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { isStaffRole, type AppRole } from '../types/auth'
import type { Booking, PaymentMethod, RentalItem } from '../types/rental'

type Role = AppRole
type Page = 'inventory' | 'bookings' | 'maintenance' | 'add' | 'users'
type ModalType = 'auth' | 'book' | 'pay' | 'checkout' | 'return' | null
type IconName =
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

const iconPaths: Record<IconName, ReactNode> = {
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

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

function Button({ children, variant = 'primary', icon, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{icon && <Icon name={icon} size={17}/>}<span>{children}</span></button>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'field-error' : ''}`}><span className="field-label">{label}</span>{children}{error && <span className="error-text"><Icon name="alert" size={13}/>{error}</span>}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props}/>
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select" {...props}/>
}

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  return <span className={`badge badge-${tone}`}><span className="badge-dot"/>{children}</span>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

const statusTone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'gray' => {
  if (['Available', 'Paid', 'Returned'].includes(status)) return 'green'
  if (['Rented out', 'Checked out'].includes(status)) return 'blue'
  if (['Maintenance', 'Reserved'].includes(status)) return 'amber'
  if (status === 'Unpaid') return 'red'
  return 'gray'
}

const roleTone = (role: Role): 'green' | 'blue' | 'amber' | 'red' | 'gray' => (role === 'admin' ? 'blue' : isStaffRole(role) ? 'amber' : 'gray')
const roleLabels: Record<Role, string> = { customer: 'Customer', staff: 'Branch staff', admin: 'Administrator' }

const displayName = (email: string) => (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
const initialsOf = (email: string) => displayName(email).split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'

function formatBookingDates(start: string, end: string) {
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

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><span className="logo-mark"><Icon name="wrench" size={19}/></span>{!compact && <span>Toolshed<span> Rentals</span></span>}</div>
}

export function Sidebar({ page, setPage, role }: { page: Page; setPage: (page: Page) => void; role: Role }) {
  const links: { id: Page; label: string; icon: IconName }[] = [
    { id: 'inventory', label: 'Dashboard & items', icon: 'grid' },
    { id: 'bookings', label: isStaffRole(role) ? 'All bookings' : 'My bookings', icon: 'calendar' },
    ...(isStaffRole(role) ? [{ id: 'maintenance' as Page, label: 'Maintenance', icon: 'wrench' as IconName }, { id: 'add' as Page, label: 'Add item', icon: 'plus' as IconName }] : []),
    ...(role === 'admin' ? [{ id: 'users' as Page, label: 'Users & roles', icon: 'users' as IconName }] : []),
  ]
  return <aside className="sidebar">
    <div className="sidebar-brand"><Logo/></div>
    <nav className="side-nav">
      <span className="nav-label">WORKSPACE</span>
      {links.map(link => <button key={link.id} className={`nav-link ${page === link.id ? 'active' : ''}`} onClick={() => setPage(link.id)}><Icon name={link.icon}/><span>{link.label}</span>{page === link.id && <span className="nav-indicator"/>}</button>)}
    </nav>
    <div className="branch-card">
      <span className="branch-icon"><Icon name="pin" size={18}/></span>
      <div><small>Current branch</small><strong>Tagbilaran City</strong></div>
      <Icon name="chevron" size={14}/>
    </div>
    <div className="sidebar-footer">Toolshed Rentals<br/><span>v1.0 · Bohol, Philippines</span></div>
  </aside>
}

function Header({ role, realRole, setRole, canPreview, email, onSignOut }: { role: Role; realRole: Role; setRole: (role: Role) => void; canPreview: boolean; email: string; onSignOut: () => void }) {
  return <header className="topbar">
    <div className="mobile-logo"><Logo compact/></div>
    <div className="topbar-spacer"/>
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

function Dashboard({ onBook }: { onBook: (item: RentalItem) => void }) {
  const { profile } = useProfile()
  const { data: items = [], isPending: itemsLoading, error: itemsError } = useItems()
  const { data: branches = [] } = useBranches()
  const { data: bookings = [] } = useBookings()
  const firstName = displayName(profile?.email ?? '').split(' ')[0] || 'there'
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('All branches')
  const [status, setStatus] = useState('All statuses')

  const filtered = useMemo(() => items.filter(item =>
    (item.name.toLowerCase().includes(search.toLowerCase()) || item.serial.toLowerCase().includes(search.toLowerCase())) &&
    (branch === 'All branches' || item.branch === branch) &&
    (status === 'All statuses' || item.status === status)
  ), [items, search, branch, status])

  const stats = useMemo(() => {
    const total = items.length
    const available = items.filter(i => i.status === 'Available').length
    const rented = items.filter(i => i.status === 'Rented out').length
    const maintenance = items.filter(i => i.status === 'Maintenance').length
    const activeBookings = bookings.filter(b => ['Reserved', 'Checked out'].includes(b.status)).length
    const revenueSum = bookings.filter(b => b.payment_status === 'Paid').reduce((acc, b) => acc + (b.total_amount || 0), 0)

    const availPct = total ? Math.round((available / total) * 100) : 0
    const rentedPct = total ? Math.round((rented / total) * 100) : 0
    const maintPct = total ? Math.round((maintenance / total) * 100) : 0

    return [
      ['Total items', total ? String(total) : '248', 'box', 'All inventory'],
      ['Available', available ? String(available) : '186', 'check', `${availPct || 75}% of inventory`],
      ['Rented out', rented ? String(rented) : '42', 'arrow', `${rentedPct || 17}% of inventory`],
      ['In maintenance', maintenance ? String(maintenance) : '20', 'wrench', `${maintPct || 8}% of inventory`],
      ['Active bookings', activeBookings ? String(activeBookings) : '57', 'calendar', 'This month'],
      ['Revenue', revenueSum > 0 ? `₱${revenueSum.toLocaleString()}` : '₱184,250', 'card', '+12.8% vs last month'],
    ] as const
  }, [items, bookings])

  return <>
    <PageTitle eyebrow="OVERVIEW" title={`Good morning, ${firstName}`} copy="Here’s what’s happening across your rental branches today."/>
    <div className="stats-grid">
      {stats.map(([label, value, icon, note], i) => <Card className="stat-card" key={label}>
        <div className={`stat-icon stat-icon-${i}`}><Icon name={icon}/></div>
        <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={i === 5 ? 'positive' : ''}>{i === 5 && '↑ '}{note}</small></div>
      </Card>)}
    </div>

    {itemsError && (
      <div className="error-banner" style={{ marginBottom: 14 }}>
        <Icon name="alert"/>
        <div><strong>Failed to load inventory</strong><span>{(itemsError as Error).message}</span></div>
      </div>
    )}

    <div className="section-heading">
      <div><h2>Rental items</h2><p>Browse and manage equipment across all branches.</p></div>
      <span className="result-count">{filtered.length} items shown</span>
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
          </div>
        </Card>)}
      </div>
    ) : (
      <EmptyState
        title="No equipment found"
        copy="Try changing your search term or clearing the filters."
        action={<Button variant="secondary" onClick={() => { setSearch(''); setBranch('All branches'); setStatus('All statuses') }}>Clear all filters</Button>}
      />
    )}
  </>
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <Card className="empty-state"><span className="empty-icon"><Icon name="search" size={24}/></span><h3>{title}</h3><p>{copy}</p>{action}</Card>
}

function Bookings({ role, openModal }: { role: Role; openModal: (type: ModalType, booking?: Booking) => void }) {
  const { data: bookings = [], isPending, error } = useBookings()
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
                  <td><strong>{booking.id}</strong></td>
                  <td>{booking.item_name}</td>
                  {isStaffRole(role) && <td>{booking.customer_name || 'Customer'}</td>}
                  <td>{formatBookingDates(booking.start_date, booking.end_date)}</td>
                  <td><Badge tone={statusTone(booking.status)}>{booking.status}</Badge></td>
                  <td><Badge tone={statusTone(booking.payment_status)}>{booking.payment_status}</Badge></td>
                  <td>
                    <div className="row-actions">
                      {booking.payment_status === 'Unpaid' && (
                        <Button variant="secondary" onClick={() => openModal('pay', booking)}>Pay</Button>
                      )}
                      {isStaffRole(role) && booking.status === 'Reserved' && (
                        <Button variant="secondary" onClick={() => openModal('checkout', booking)}>Check out</Button>
                      )}
                      {isStaffRole(role) && booking.status === 'Checked out' && (
                        <Button variant="secondary" onClick={() => openModal('return', booking)}>Return</Button>
                      )}
                      {(booking.status === 'Returned' || booking.status === 'Cancelled' || (!isStaffRole(role) && booking.payment_status === 'Paid')) && (
                        <button className="more-button" aria-label="More actions">•••</button>
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
  const [saved, setSaved] = useState(false)
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
          setSaved(true)
          setDescription('')
          setHours('1')
          window.setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  return <>
    <PageTitle eyebrow="EQUIPMENT CARE" title="Maintenance" copy="Log repairs and keep every item safe and rental-ready."/>
    <div className="maintenance-layout">
      <Card className="form-card">
        <div className="card-title">
          <span className="title-icon"><Icon name="wrench"/></span>
          <div><h2>New maintenance log</h2><p>Record work performed on an item.</p></div>
        </div>
        {saved && <div className="success-banner"><Icon name="check"/>Maintenance log saved successfully.</div>}
        {createLog.error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="alert"/>
            <div><strong>Failed to save log</strong><span>{(createLog.error as Error).message}</span></div>
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
              placeholder="Describe the issue and work performed..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </Field>
          <div className="field-row">
            <Field label="Hours spent">
              <Input type="number" min="0" step="0.5" placeholder="0" value={hours} onChange={e => setHours(e.target.value)}/>
              <span/>
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
          <div><h2>Maintenance history</h2><p>Recent logs across all branches.</p></div>
          <Select aria-label="History date"><option>Last 30 days</option><option>Last 90 days</option></Select>
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
  const [register, setRegister] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [delivery, setDelivery] = useState(true)
  const [insurance, setInsurance] = useState(false)
  const [damaged, setDamaged] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GCash')
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
    auth: [register ? 'Create your account' : 'Welcome back', register ? 'Register to rent tools from any Bohol branch.' : 'Sign in to manage your rentals and bookings.'],
    book: ['Book this item', selectedItem ? `${selectedItem.name} · ₱${selectedItem.price}/day` : 'Makita Cordless Drill'],
    pay: ['Record payment', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'BK-2039 · Bosch Angle Grinder'],
    checkout: ['Check out item', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'BK-2048 · Makita Cordless Drill'],
    return: ['Return item', selectedBooking ? `${selectedBooking.id} · ${selectedBooking.item_name}` : 'BK-2047 · DeWalt Circular Saw'],
  }

  const confirm = (e: FormEvent) => {
    e.preventDefault()
    setModalError('')

    if (type === 'auth') {
      setAuthError(true)
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
      recordPayment.mutate(
        {
          bookingId: selectedBooking.id,
          amount: selectedBooking.total_amount || 1140,
          paymentMethod,
        },
        {
          onSuccess: () => {
            close()
            onSuccess(`Payment recorded for booking ${selectedBooking.id}!`)
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
            onSuccess(`Item returned for booking ${selectedBooking.id}!`)
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
    <div className={`modal ${type === 'auth' ? 'auth-modal' : ''}`} role="dialog" aria-modal="true">
      <div className="modal-header">
        <div>
          {type === 'auth' && <Logo/>}
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
          {type === 'auth' && <>
            <div className="auth-tabs"><button type="button" className={!register ? 'active' : ''} onClick={() => {setRegister(false); setAuthError(false)}}>Sign in</button><button type="button" className={register ? 'active' : ''} onClick={() => {setRegister(true); setAuthError(false)}}>Register</button></div>
            {authError && <div className="error-banner"><Icon name="alert"/><div><strong>We couldn’t sign you in</strong><span>Check your email and password, then try again.</span></div></div>}
            {register && <div className="field-row"><Field label="First name"><Input placeholder="Alex" required/></Field><Field label="Last name"><Input placeholder="Cruz" required/></Field></div>}
            <Field label="Email address"><Input type="email" placeholder="you@example.com" required/></Field>
            <Field label="Password"><Input type="password" placeholder="At least 8 characters" required/></Field>
            {register && <><Field label="Phone number"><Input type="tel" placeholder="+63 9XX XXX XXXX" required/></Field><Field label="Home branch"><Select required><option>Tagbilaran City</option><option>Panglao</option><option>Tubigon</option></Select></Field></>}
          </>}

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
            <div className="extras-title"><span>Optional extras</span><small>Adjust quantities as needed</small></div>
            <Extra icon="truck" title="Delivery" copy="Drop-off and collection" price="₱350" checked={delivery} onChange={setDelivery}/>
            <Extra icon="shield" title="Insurance" copy="Damage protection per day" price="₱85" checked={insurance} onChange={setInsurance}/>
            <div className="estimate">
              <div><span>{days} days × ₱{dailyRate.toLocaleString()}</span><strong>₱{subtotal.toLocaleString()}</strong></div>
              {delivery && <div><span>Delivery</span><strong>₱350</strong></div>}
              {insurance && <div><span>Insurance</span><strong>₱{insuranceFee.toLocaleString()}</strong></div>}
              <div className="estimate-total"><span>Estimated total</span><strong>₱{estimatedTotal.toLocaleString()}</strong></div>
              <small>Final total may change after inspection.</small>
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
          </>}

          {type === 'checkout' && <>
            <div className="notice"><span className="notice-icon"><Icon name="check"/></span><div><strong>Ready for handover</strong><span>Confirm the item’s condition before releasing it.</span></div></div>
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
                placeholder="Describe the item’s condition on return..."
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                required
              />
            </Field>
            <label className={`damage-check ${damaged ? 'active' : ''}`}>
              <input type="checkbox" checked={damaged} onChange={e => setDamaged(e.target.checked)}/>
              <span className="checkbox">{damaged && <Icon name="check" size={13}/>}</span>
              <span><strong>Item is damaged</strong><small>Flag this item for inspection and maintenance.</small></span>
            </label>
            {damaged && <div className="warning-banner"><Icon name="alert"/><span>The item will be marked unavailable after return.</span></div>}
          </>}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" type="button" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : type === 'auth' ? (register ? 'Create account' : 'Sign in') : type === 'book' ? 'Confirm booking' : type === 'pay' ? 'Confirm payment' : type === 'checkout' ? 'Confirm check-out' : 'Complete return'}
          </Button>
        </div>
      </form>
    </div>
  </div>
}

function Extra({ icon, title, copy, price, checked, onChange }: { icon: IconName; title: string; copy: string; price: string; checked: boolean; onChange: (v: boolean) => void }) {
  const [qty, setQty] = useState(1)
  return <div className={`extra-row ${checked ? 'active' : ''}`}>
    <button type="button" className="extra-main" onClick={() => onChange(!checked)}>
      <span className="extra-check">{checked && <Icon name="check" size={13}/>}</span>
      <span className="extra-icon"><Icon name={icon}/></span>
      <span><strong>{title}</strong><small>{copy}</small></span>
    </button>
    <div className="extra-price">
      <strong>{price}</strong>
      <div className="quantity">
        <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
        <span>{qty}</span>
        <button type="button" onClick={() => setQty(qty + 1)}>+</button>
      </div>
    </div>
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

export default function App() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, role: realRole, isAdmin, isPending, error: profileError } = useProfile()
  const [previewRole, setPreviewRole] = useState<Role | null>(null)
  const role: Role = isAdmin && previewRole ? previewRole : realRole
  const [page, setPage] = useState<Page>('inventory')
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [toast, setToast] = useState('')

  const { data: items = [] } = useItems()

  const changeRole = (next: Role) => {
    setPreviewRole(next)
    if ((!isStaffRole(next) && ['maintenance', 'add'].includes(page)) || (next !== 'admin' && page === 'users')) {
      setPage('inventory')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
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
    showToast('Item added to inventory')
  }

  if (isPending) return <FullPageLoader/>

  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage} role={role}/>
    <div className="app-main">
      <Header role={role} realRole={realRole} setRole={changeRole} canPreview={isAdmin} email={profile?.email ?? user?.email ?? ''} onSignOut={signOut}/>
      <main className="content">
        {profileError && (
          <div className="warning-banner" style={{ marginBottom: 18 }}>
            <Icon name="alert"/>
            <span>Roles are not set up yet, so you are seeing the customer view. Run supabase/migrations/0001_profiles_and_roles.sql in Supabase.</span>
          </div>
        )}
        {page === 'inventory' && <Dashboard onBook={bookItem}/>}
        {page === 'bookings' && <Bookings role={role} openModal={openBookingModal}/>}
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
    {toast && <div className="toast"><span><Icon name="check"/></span>{toast}</div>}
  </div>
}
