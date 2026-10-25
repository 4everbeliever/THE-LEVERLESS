import { Icon, type IconName, type Page, type Role } from './UI'
import { isStaffRole } from '../types/auth'

export function MobileNav({
  page,
  setPage,
  role,
}: {
  page: Page
  setPage: (p: Page) => void
  role: Role
}) {
  const links = [
    { id: 'inventory' as Page, label: 'Home', icon: 'grid' as IconName },
    { id: 'bookings' as Page, label: 'Bookings', icon: 'calendar' as IconName },
    ...(isStaffRole(role)
      ? [
          { id: 'maintenance' as Page, label: 'Service', icon: 'wrench' as IconName },
          { id: 'add' as Page, label: 'Add item', icon: 'plus' as IconName },
        ]
      : []),
    ...(role === 'admin' ? [{ id: 'users' as Page, label: 'Users', icon: 'users' as IconName }] : []),
  ]

  return (
    <nav className="mobile-nav">
      {links.map(link => (
        <button
          className={page === link.id ? 'active' : ''}
          onClick={() => setPage(link.id)}
          key={link.id}
        >
          <Icon name={link.icon} />
          <span>{link.label}</span>
        </button>
      ))}
    </nav>
  )
}
