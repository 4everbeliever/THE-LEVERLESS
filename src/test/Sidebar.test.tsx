import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../pages/Dashboard'

describe('Role-based Sidebar', () => {
  it('renders only customer links for customer role', () => {
    const setPage = vi.fn()
    render(<Sidebar page="inventory" setPage={setPage} role="customer" />)

    expect(screen.getByText('Dashboard & items')).toBeInTheDocument()
    expect(screen.getByText('My bookings')).toBeInTheDocument()
    expect(screen.queryByText('All bookings')).not.toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
    expect(screen.queryByText('Add item')).not.toBeInTheDocument()
    expect(screen.queryByText('Users & roles')).not.toBeInTheDocument()
  })

  it('renders staff links for staff role but hides admin Users & roles', () => {
    const setPage = vi.fn()
    render(<Sidebar page="inventory" setPage={setPage} role="staff" />)

    expect(screen.getByText('Dashboard & items')).toBeInTheDocument()
    expect(screen.getByText('All bookings')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Add item')).toBeInTheDocument()
    expect(screen.queryByText('Users & roles')).not.toBeInTheDocument()
  })

  it('renders all links including Users & roles for admin role', () => {
    const setPage = vi.fn()
    render(<Sidebar page="inventory" setPage={setPage} role="admin" />)

    expect(screen.getByText('Dashboard & items')).toBeInTheDocument()
    expect(screen.getByText('All bookings')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Add item')).toBeInTheDocument()
    expect(screen.getByText('Users & roles')).toBeInTheDocument()
  })

  it('calls setPage when a nav link is clicked', async () => {
    const user = userEvent.setup()
    const setPage = vi.fn()
    render(<Sidebar page="inventory" setPage={setPage} role="admin" />)

    await user.click(screen.getByText('Users & roles'))
    expect(setPage).toHaveBeenCalledWith('users')
  })
})
