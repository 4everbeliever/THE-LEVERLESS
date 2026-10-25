import { Icon, Logo, type IconName, type Page, type Role } from './UI'
import { isStaffRole } from '../types/auth'

export function Sidebar({ page, setPage, role }: { page: Page; setPage: (page: Page) => void; role: Role }) {
  const links: { id: Page; label: string; icon: IconName }[] = [
    { id: 'inventory', label: 'Dashboard & items', icon: 'grid' },
    { id: 'bookings', label: isStaffRole(role) ? 'All bookings' : 'My bookings', icon: 'calendar' },
    ...(isStaffRole(role)
      ? [
          { id: 'maintenance' as Page, label: 'Maintenance', icon: 'wrench' as IconName },
          { id: 'add' as Page, label: 'Add item', icon: 'plus' as IconName },
        ]
      : []),
    ...(role === 'admin' ? [{ id: 'users' as Page, label: 'Users & roles', icon: 'users' as IconName }] : []),
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
      </div>
      <nav className="side-nav">
        <span className="nav-label">WORKSPACE</span>
        {links.map(link => (
          <button
            key={link.id}
            className={`nav-link ${page === link.id ? 'active' : ''}`}
            onClick={() => setPage(link.id)}
          >
            <Icon name={link.icon} />
            <span>{link.label}</span>
            {page === link.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>
      <div className="branch-card">
        <span className="branch-icon">
          <Icon name="pin" size={18} />
        </span>
        <div>
          <small>Current branch</small>
          <strong>Tagbilaran City</strong>
        </div>
        <Icon name="chevron" size={14} />
      </div>
      <div className="sidebar-footer">
        Toolshed Rentals
        <br />
        <span>v1.0 · Bohol, Philippines</span>
      </div>
    </aside>
  )
}
