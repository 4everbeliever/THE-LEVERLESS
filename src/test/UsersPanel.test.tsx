import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UsersPanel } from '../pages/Dashboard'
import * as useAdminUsersModule from '../hooks/useAdminUsers'

vi.mock('../hooks/useAdminUsers')

const mockUsers = [
  {
    id: 'user-admin',
    email: 'admin@toolshed.ph',
    role: 'admin' as const,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-staff',
    email: 'staff@toolshed.ph',
    role: 'staff' as const,
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'user-customer',
    email: 'maria@example.com',
    role: 'customer' as const,
    created_at: '2025-03-01T00:00:00Z',
  },
]

describe('Admin UsersPanel', () => {
  it('renders list of users and their current roles', () => {
    vi.spyOn(useAdminUsersModule, 'useAdminUsers').mockReturnValue({
      data: mockUsers,
      isPending: false,
      error: null,
    } as any)
    vi.spyOn(useAdminUsersModule, 'useUpdateRole').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any)

    render(<UsersPanel currentUserId="user-admin" />)

    expect(screen.getByText('admin@toolshed.ph')).toBeInTheDocument()
    expect(screen.getByText('staff@toolshed.ph')).toBeInTheDocument()
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })

  it('disables role selector for the current logged-in user', () => {
    vi.spyOn(useAdminUsersModule, 'useAdminUsers').mockReturnValue({
      data: mockUsers,
      isPending: false,
      error: null,
    } as any)
    vi.spyOn(useAdminUsersModule, 'useUpdateRole').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any)

    render(<UsersPanel currentUserId="user-admin" />)

    const adminSelect = screen.getByLabelText('Role for admin@toolshed.ph')
    expect(adminSelect).toBeDisabled()

    const staffSelect = screen.getByLabelText('Role for staff@toolshed.ph')
    expect(staffSelect).toBeEnabled()
  })

  it('triggers updateRole mutation when changing another user role', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()

    vi.spyOn(useAdminUsersModule, 'useAdminUsers').mockReturnValue({
      data: mockUsers,
      isPending: false,
      error: null,
    } as any)
    vi.spyOn(useAdminUsersModule, 'useUpdateRole').mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    } as any)

    render(<UsersPanel currentUserId="user-admin" />)

    const customerSelect = screen.getByLabelText('Role for maria@example.com')
    await user.selectOptions(customerSelect, 'staff')

    expect(mockMutate).toHaveBeenCalledWith(
      { id: 'user-customer', role: 'staff' },
      expect.any(Object)
    )
  })

  it('filters users by search input', async () => {
    const user = userEvent.setup()

    vi.spyOn(useAdminUsersModule, 'useAdminUsers').mockReturnValue({
      data: mockUsers,
      isPending: false,
      error: null,
    } as any)
    vi.spyOn(useAdminUsersModule, 'useUpdateRole').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any)

    render(<UsersPanel currentUserId="user-admin" />)

    const searchInput = screen.getByPlaceholderText('Search by email...')
    await user.type(searchInput, 'maria')

    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.queryByText('admin@toolshed.ph')).not.toBeInTheDocument()
    expect(screen.queryByText('staff@toolshed.ph')).not.toBeInTheDocument()
  })
})
