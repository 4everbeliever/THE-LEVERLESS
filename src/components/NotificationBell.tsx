import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './UI'
import { useItems } from '../hooks/useInventory'
import { useBookings } from '../hooks/useBookings'

export type AppNotification = {
  id: string
  title: string
  message: string
  time: string
  type: 'info' | 'warning' | 'success' | 'alert'
  isRead: boolean
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: items = [] } = useItems()
  const { data: bookings = [] } = useBookings()
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate dynamic operational notifications from real database state
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = []

    // 1. Check for overdue bookings
    const overdueBookings = bookings.filter(b => b.is_overdue)
    overdueBookings.forEach(b => {
      list.push({
        id: `overdue-${b.id}`,
        title: '⚠️ Equipment Overdue',
        message: `${b.item_name} (${b.id}) is past scheduled return time. Contact renter.`,
        time: 'Immediate',
        type: 'warning',
        isRead: readIds.has(`overdue-${b.id}`),
      })
    })

    // 2. Check for maintenance items
    const maintItems = items.filter(i => i.status === 'Maintenance')
    maintItems.forEach(i => {
      list.push({
        id: `maint-${i.id}`,
        title: 'Tool Under Maintenance',
        message: `${i.name} (${i.serial}) undergoing technical servicing at ${i.branch || 'branch'}.`,
        time: 'Active',
        type: 'info',
        isRead: readIds.has(`maint-${i.id}`),
      })
    })

    // 3. Check for recently reserved bookings
    const recentReservations = bookings.filter(b => b.status === 'Reserved').slice(0, 3)
    recentReservations.forEach(b => {
      list.push({
        id: `reserved-${b.id}`,
        title: 'New Reservation',
        message: `${b.item_name} reserved for ${b.branch_name || 'pickup'}. Code: ${b.id}.`,
        time: 'Today',
        type: 'success',
        isRead: readIds.has(`reserved-${b.id}`),
      })
    })

    // Default system notification
    list.push({
      id: 'system-engine',
      title: 'Database Cloud Engine',
      message: 'PostgreSQL cluster synchronized across Tagbilaran, Panglao & Tubigon branches.',
      time: 'Live',
      type: 'info',
      isRead: readIds.has('system-engine'),
    })

    return list
  }, [items, bookings, readIds])

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)))
  }

  const markItemAsRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]))
  }

  return (
    <div className="notifications-wrapper" ref={containerRef}>
      <button
        className="icon-button notification"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <Icon name="bell" />
        {unreadCount > 0 && <span />}
      </button>

      {isOpen && (
        <div className="notifications-popover" role="dialog" aria-label="Notifications list">
          <div className="notifications-popover-header">
            <div>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {unreadCount} unread
                </small>
              )}
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notifications-popover-list">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`notifications-popover-item ${notif.isRead ? 'read' : 'unread'} ${notif.type}`}
                onClick={() => markItemAsRead(notif.id)}
              >
                <div className="notif-content">
                  <div className="notif-title-row">
                    <strong>{notif.title}</strong>
                    <span className="notif-time">{notif.time}</span>
                  </div>
                  <p>{notif.message}</p>
                </div>
                {!notif.isRead && <span className="unread-dot" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
