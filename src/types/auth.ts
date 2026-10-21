export type LoginFormValues = {
  email: string
  password: string
}

export type AppRole = 'customer' | 'staff' | 'admin'

export type Profile = {
  id: string
  email: string
  role: AppRole
  created_at: string
}

/** Staff features are available to staff and admins. */
export const isStaffRole = (role: AppRole) => role === 'staff' || role === 'admin'
