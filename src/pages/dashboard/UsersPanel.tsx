import { useMemo, useState } from 'react'
import { Badge, Card, EmptyState, Icon, PageTitle, Select, roleLabels, roleTone, type Role } from '../../components/UI'
import { useAdminUsers, useUpdateRole } from '../../hooks/useAdminUsers'

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
    onSuccess: () => {
      setNotice(`${email} is now ${roleLabels[role].toLowerCase()}.`)
      window.setTimeout(() => setNotice(''), 3000)
    },
  })

  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="Users & roles"
        copy="Control who can rent, run the counter, or manage the whole system."
      />
      {notice && <div className="success-banner"><Icon name="check" />{notice}</div>}
      {updateRole.error && (
        <div className="error-banner" style={{ marginBottom: 14 }}>
          <Icon name="alert" />
          <div><strong>Role was not changed</strong><span>{(updateRole.error as Error).message}</span></div>
        </div>
      )}
      {error && (
        <div className="error-banner" style={{ marginBottom: 14 }}>
          <Icon name="alert" />
          <div><strong>We couldn’t load the users</strong><span>{(error as Error).message}</span></div>
        </div>
      )}
      <Card className="table-card">
        <div className="table-toolbar">
          <div className="search-box compact">
            <Icon name="search" />
            <input
              placeholder="Search by email..."
              aria-label="Search users"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option>All roles</option>
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        {isPending ? (
          <div style={{ padding: 24, fontSize: 11 }}>Loading users…</div>
        ) : filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Current role</th>
                  <th>Change role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = u.id === currentUserId
                  const saving = updateRole.isPending && updateRole.variables?.id === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.email}</strong>
                        {isSelf && <small style={{ marginLeft: 8, opacity: 0.6 }}>(you)</small>}
                      </td>
                      <td>
                        <Badge tone={roleTone(u.role)}>{roleLabels[u.role]}</Badge>
                      </td>
                      <td>
                        <Select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          disabled={isSelf || saving}
                          title={isSelf ? 'You cannot change your own role' : undefined}
                          onChange={e => change(u.id, u.email, e.target.value as Role)}
                          style={{ width: 150, minHeight: 34 }}
                        >
                          <option value="customer">Customer</option>
                          <option value="staff">Branch staff</option>
                          <option value="admin">Administrator</option>
                        </Select>
                      </td>
                      <td>
                        {new Date(u.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No users found" copy="Try a different search or role filter." />
        )}
        <div className="table-footer">
          <span>Showing {filtered.length} of {users?.length ?? 0} users</span>
        </div>
      </Card>
    </>
  )
}
