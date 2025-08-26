import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  User,
  Settings,
  RefreshCw,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { useDashboardStore } from '@/stores/dashboard'
import { formatters } from '@/utils'
import { notificationManager } from '@/utils/notifications'
import SettingsModal from '@/components/modals/SettingsModal'
import NotificationsModal from '@/components/modals/NotificationsModal'

interface HeaderProps {
  onMobileMenuToggle: () => void
}

const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const {
    theme,
    setTheme,
    lastUpdate,
    realtimeMetrics,
  } = useDashboardStore()
  
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Use notification manager for unread count
  const [unreadCount, setUnreadCount] = useState(0)

  // Subscribe to notification manager for unread count updates
  React.useEffect(() => {
    const updateUnreadCount = () => {
      setUnreadCount(notificationManager.getUnreadCount())
    }
    
    // Initial count
    updateUnreadCount()
    
    // Subscribe to changes
    const unsubscribe = notificationManager.subscribe(() => {
      updateUnreadCount()
    })
    
    return unsubscribe
  }, [])

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return {
          title: 'Dashboard',
          subtitle: 'Real-time monitoring and compliance overview',
          breadcrumb: ['Dashboard']
        }
      case '/testing':
        return {
          title: 'Test Suite',
          subtitle: 'Run compliance tests and validation',
          breadcrumb: ['Dashboard', 'Test Suite']
        }
      case '/stream':
        return {
          title: 'Stream Monitor',
          subtitle: 'Live stream analysis and monitoring',
          breadcrumb: ['Dashboard', 'Stream Monitor']
        }
      case '/audit':
        return {
          title: 'Audit Logs',
          subtitle: 'Compliance audit trail and history',
          breadcrumb: ['Dashboard', 'Audit Logs']
        }
      default:
        return {
          title: 'Compliance Dashboard',
          subtitle: 'Real-time monitoring and testing for regulated industries',
          breadcrumb: ['Dashboard']
        }
    }
  }

  const pageInfo = getPageInfo()

  const handleNotificationClick = () => {
    setShowNotifications(true)
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  const handleThemeToggle = () => {
    const themes = ['light', 'dark', 'system'] as const
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return Sun
      case 'dark':
        return Moon
      default:
        return Monitor
    }
  }

  const ThemeIcon = getThemeIcon()

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-b border-gray-200/60 dark:border-gray-700/60 px-3 xs:px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40 shadow-soft"
      >
        <div className="flex items-center justify-between">
          {/* Mobile Menu Button + Page Title & Breadcrumb */}
          <div className="flex items-center space-x-2 xs:space-x-3 min-w-0 flex-1">
            {/* Enhanced Mobile Menu Button with Accessibility */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onMobileMenuToggle}
              aria-label="Toggle mobile navigation menu"
              aria-expanded="false"
              aria-controls="mobile-menu"
              className="lg:hidden p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md touch-target focus-ring"
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
              <span className="sr-only">Open main menu</span>
            </motion.button>
            
            <div className="min-w-0 flex-1">
              {/* Breadcrumb - Hidden on small screens */}
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                {pageInfo.breadcrumb.map((crumb, index) => (
                  <React.Fragment key={crumb}>
                    {index > 0 && <ChevronRight className="w-4 h-4" />}
                    <span className={index === pageInfo.breadcrumb.length - 1 ? 'text-primary-600 dark:text-primary-400 font-medium' : ''}>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              {/* Enhanced Page Title - Mobile-First Responsive sizing */}
              <motion.h1 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight"
              >
                {pageInfo.title}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="hidden xs:block text-xs xs:text-sm text-gray-500 dark:text-gray-400 truncate leading-relaxed"
              >
                {pageInfo.subtitle}
              </motion.p>
            </div>
          </div>

          {/* Status & Actions - Mobile-First Responsive Design */}
          <div className="flex items-center space-x-1 xs:space-x-2 sm:space-x-3 md:space-x-4">
            {/* Enhanced Real-time Stats - Desktop Display */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="hidden xl:flex items-center space-x-4 px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-inner border border-gray-200/50 dark:border-gray-600/50 text-sm"
              role="region"
              aria-label="Real-time system metrics"
            >
              <div className="flex items-center space-x-2" role="group" aria-label="Total requests">
                <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse shadow-glow" aria-hidden="true" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {realtimeMetrics.total_requests}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Requests
                </span>
              </div>
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center space-x-2" role="group" aria-label="Block rate">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse shadow-sm ${
                    realtimeMetrics.block_rate > 10
                      ? 'bg-danger-500 shadow-red-400/50'
                      : realtimeMetrics.block_rate > 5
                      ? 'bg-warning-500 shadow-yellow-400/50'
                      : 'bg-success-500 shadow-green-400/50'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {realtimeMetrics.block_rate.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Blocked
                </span>
              </div>
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center space-x-2" role="group" aria-label="Last update">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  aria-hidden="true"
                >
                  <RefreshCw className="w-3 h-3 text-gray-400" />
                </motion.div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {formatters.relative(lastUpdate)}
                </span>
              </div>
            </motion.div>

            {/* Enhanced Compact Stats for Large Screens */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:flex xl:hidden items-center space-x-2 px-2.5 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-inner border border-gray-200/50 dark:border-gray-600/50"
              role="region"
              aria-label="Compact system metrics"
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300" aria-label={`${realtimeMetrics.total_requests} requests`}>
                {realtimeMetrics.total_requests}
              </span>
              <div
                className={`w-2 h-2 rounded-full animate-pulse shadow-sm ${
                  realtimeMetrics.block_rate > 10
                    ? 'bg-danger-500 shadow-red-400/50'
                    : realtimeMetrics.block_rate > 5
                    ? 'bg-warning-500 shadow-yellow-400/50'
                    : 'bg-success-500 shadow-green-400/50'
                }`}
                aria-label={`${realtimeMetrics.block_rate.toFixed(1)}% block rate`}
              />
            </motion.div>

            {/* Mobile Status Indicator */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex lg:hidden items-center"
              role="region"
              aria-label="System status"
            >
              <div
                className={`w-3 h-3 rounded-full animate-pulse ${
                  realtimeMetrics.block_rate > 10
                    ? 'bg-danger-500'
                    : realtimeMetrics.block_rate > 5
                    ? 'bg-warning-500'
                    : 'bg-success-500'
                }`}
                aria-label={`System ${realtimeMetrics.block_rate > 10 ? 'alert' : realtimeMetrics.block_rate > 5 ? 'warning' : 'healthy'}`}
              />
            </motion.div>

            {/* Enhanced Notifications with Accessibility */}
            <motion.button
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNotificationClick}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-describedby={unreadCount > 0 ? 'notification-badge' : undefined}
              className="relative p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md touch-target focus-ring"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="absolute -top-0.5 -right-0.5 min-w-5 h-5 bg-gradient-to-r from-danger-500 to-danger-600 rounded-full flex items-center justify-center shadow-lg animate-pulse px-1"
                  id="notification-badge"
                  role="status"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  <span className="text-xs text-white font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </motion.div>
              )}
            </motion.button>

            {/* Enhanced Theme Toggle with Accessibility */}
            <motion.button
              whileHover={{ scale: 1.05, y: -1, rotate: 15 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleThemeToggle}
              aria-label={`Switch theme. Current theme: ${theme}`}
              title={`Switch theme (current: ${theme})`}
              className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md touch-target focus-ring"
            >
              <motion.div
                animate={{ rotate: theme === 'system' ? [0, 360] : 0 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              >
                <ThemeIcon className="w-5 h-5" aria-hidden="true" />
              </motion.div>
              <span className="sr-only">Toggle theme</span>
            </motion.button>

            {/* Enhanced Settings with Accessibility */}
            <motion.button
              whileHover={{ scale: 1.05, y: -1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSettingsClick}
              aria-label="Open settings"
              className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md touch-target focus-ring"
            >
              <Settings className="w-5 h-5" aria-hidden="true" />
              <span className="sr-only">Settings</span>
            </motion.button>

            {/* Enhanced User Profile with Accessibility */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              aria-label="User profile menu"
              className="flex items-center space-x-2 sm:space-x-3 px-2 sm:px-3 py-2 sm:py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl transition-all duration-200 hover:shadow-md shadow-inner border border-gray-200/50 dark:border-gray-600/50 touch-target focus-ring"
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-primary-600 to-primary-700 rounded-full flex items-center justify-center shadow-lg ring-2 ring-primary-100 dark:ring-primary-900/50 flex-shrink-0"
                role="img"
                aria-label="User avatar"
              >
                <User className="w-4 h-4 text-white drop-shadow-sm" aria-hidden="true" />
              </motion.div>
              <div className="hidden sm:block min-w-0">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                >
                  Compliance Admin
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate"
                >
                  System Administrator
                </motion.div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Modal Components */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      <NotificationsModal 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)}
      />
    </>
  )
}

export default Header