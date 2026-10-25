import { ReactNode } from 'react'
import { isStaffRole, type AppRole } from '../types/auth'

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
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}

export function Button({
  children,
  variant = 'primary',
  icon,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} size={17} />}
      <span>{children}</span>
    </button>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'field-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="error-text"><Icon name="alert" size={13} />{error}</span>}
    </label>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select" {...props} />
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export const statusTone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'gray' => {
  if (['Available', 'Paid', 'Returned'].includes(status)) return 'green'
  if (['Rented out', 'Checked out'].includes(status)) return 'blue'
  if (['Maintenance', 'Reserved'].includes(status)) return 'amber'
  if (status === 'Unpaid') return 'red'
  return 'gray'
}

export const roleTone = (role: Role): 'green' | 'blue' | 'amber' | 'red' | 'gray' =>
  role === 'admin' ? 'blue' : isStaffRole(role) ? 'amber' : 'gray'

export const roleLabels: Record<Role, string> = {
  customer: 'Customer',
  staff: 'Branch staff',
  admin: 'Administrator',
}

export const displayName = (email: string) =>
  (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())

export const initialsOf = (email: string) =>
  displayName(email).split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'

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
  return (
    <div className="logo">
      <span className="logo-mark"><Icon name="wrench" size={19} /></span>
      {!compact && <span>Toolshed<span> Rentals</span></span>}
    </div>
  )
}

export function PageTitle({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name="box" size={24} /></div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  )
}
