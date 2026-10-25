import { useEffect, useRef, useState } from 'react'
import { Icon } from './UI'

export type AppNotification = {
  id: string
  title: string
  message: string
  time: string
  type: 'info' | 'warning' | 'success'
  isRead: boolean
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Equipment in Maintenance',
    message: 'Bosch Angle Grinder (BAG-2024-0115) scheduled for carbon brush inspection.',
    time: '25m ago',
    type: 'warning',
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'New Booking Active',
    message: 'Makita Cordless Drill booked for Tagbilaran branch dispatch.',
    time: '2h ago',
    type: 'success',
    isRead: false,
  },
  {
    id: 'notif-3',
    title: 'Database Cloud Engine',
    message: 'Supabase PostgreSQL cluster (Bohol branches) synchronized with 12 normalized tables.',
    time: 'Today',
    type: 'info',
    isRead: false,
  },
]

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS)
  const containerRef = useRef<HTMLDivElement>(null)

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
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const markItemAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
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
            {notifications.length > 0 ? (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notifications-popover-item ${n.isRead ? 'read' : 'unread'}`}
                  onClick={() => markItemAsRead(n.id)}
                >
                  <div className={`notif-icon-badge ${n.type}`}>
                    <Icon name={n.type === 'warning' ? 'wrench' : n.type === 'success' ? 'check' : 'alert'} size={14} />
                  </div>
                  <div className="notif-body">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small>{n.time}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="notifications-empty">No notifications yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
