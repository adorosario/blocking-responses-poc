import React from 'react'
import { motion } from 'framer-motion'
import { X, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Notification } from '@/types'
import { notificationManager } from '@/utils/notifications'

interface NotificationsModalProps {
  isOpen: boolean
  onClose: () => void
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  // Use notification manager instead of local state
  const [notifications, setNotifications] = React.useState<Notification[]>([])

  // Subscribe to notification manager
  React.useEffect(() => {
    const unsubscribe = notificationManager.subscribe(setNotifications)
    // Load initial notifications
    setNotifications(notificationManager.getNotifications())
    return unsubscribe
  }, [])

  const markAllAsRead = () => {
    notificationManager.markAllAsRead()
  }

  const markAsRead = (id: string) => {
    notificationManager.markAsRead(id)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'success':
        return 'success'
      case 'warning':
        return 'warning'
      case 'error':
        return 'danger'
      default:
        return 'default'
    }
  }

  if (!isOpen) return null

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -20 }}
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="danger" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400">
              <Info className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white pr-2">
                          {notification.title}
                        </p>
                        <Badge variant={getBadgeVariant(notification.type)} className="text-xs self-start sm:self-center">
                          {notification.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        {notification.timestamp}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
            <button 
              onClick={markAllAsRead}
              className="w-full text-sm text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              Mark all as read
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default NotificationsModal
