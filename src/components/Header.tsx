import { Icon, Logo, displayName, initialsOf, roleLabels, type Role } from './UI'

export function Header({
  role,
  realRole,
  setRole,
  canPreview,
  email,
  onSignOut,
}: {
  role: Role
  realRole: Role
  setRole: (role: Role) => void
  canPreview: boolean
  email: string
  onSignOut: () => void
}) {
  return (
    <header className="topbar">
      <div className="mobile-logo">
        <Logo compact />
      </div>
      <div className="topbar-spacer" />
      {canPreview && (
        <div className="role-toggle" aria-label="Preview role">
          {(['customer', 'staff', 'admin'] as Role[]).map(r => (
            <button
              key={r}
              className={role === r ? 'active' : ''}
              onClick={() => setRole(r)}
            >
              {r === 'customer' ? 'Customer' : r === 'staff' ? 'Staff' : 'Admin'}
            </button>
          ))}
        </div>
      )}
      <button className="icon-button notification" aria-label="Notifications">
        <Icon name="bell" />
        <span />
      </button>
      <button className="user-menu" onClick={onSignOut} title="Sign out" aria-label="Sign out">
        <span className="avatar">{initialsOf(email)}</span>
        <span className="user-copy">
          <strong>{displayName(email) || 'Account'}</strong>
          <small>{roleLabels[realRole]}</small>
        </span>
        <Icon name="logout" size={14} />
      </button>
    </header>
  )
}
