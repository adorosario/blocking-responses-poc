import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  TestTube2,
  Activity,
  FileText,
  Shield,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/utils'
import { useDashboardStore } from '@/stores/dashboard'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview and metrics',
  },
  {
    name: 'Test Suite',
    href: '/testing',
    icon: TestTube2,
    description: 'Run compliance tests',
  },
  {
    name: 'Stream Monitor',
    href: '/stream',
    icon: Activity,
    description: 'Chat stream analysis',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: FileText,
    description: 'Compliance audit trail',
  },
]

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const location = useLocation()
  const { isConnected } = useDashboardStore()

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-gray-600 bg-opacity-75"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Enhanced Sidebar */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ 
          x: 0,
          opacity: 1
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "flex flex-col h-screen bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-r border-gray-200/60 dark:border-gray-700/60 shadow-soft-lg",
          // Desktop: Always visible, fixed width, full height
          "lg:flex lg:w-64 lg:h-screen",
          // Mobile/Tablet: Responsive width, overlay when open, full height
          isOpen 
            ? "fixed inset-y-0 left-0 z-50 w-5/6 max-w-sm h-screen flex lg:hidden"
            : "hidden lg:flex"
        )}
      >
      {/* Enhanced Logo/Brand */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-center h-16 px-6 border-b border-gray-200/60 dark:border-gray-700/60"
      >
        <div className="flex items-center space-x-3">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 360 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl shadow-lg ring-2 ring-primary-100 dark:ring-primary-900/50"
          >
            <Shield className="w-5 h-5 text-white drop-shadow-sm" />
          </motion.div>
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-bold text-gray-900 dark:text-white bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent"
            >
              Compliance
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-gray-500 dark:text-gray-400 font-medium"
            >
              Dashboard
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {navigation.map((item, index) => {
          const isActive = location.pathname === item.href
          const Icon = item.icon

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              whileHover={{ x: 6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <NavLink
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group relative overflow-hidden',
                    isActive
                      ? 'bg-gradient-to-r from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/10 text-primary-700 dark:text-primary-400 shadow-soft border border-primary-200/50 dark:border-primary-800/50'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700 dark:hover:to-gray-800 hover:shadow-sm hover:border hover:border-gray-200/50 dark:hover:border-gray-600/50'
                  )
                }
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-400/5 rounded-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <motion.div
                  whileHover={isActive ? {} : { scale: 1.1, rotate: 5 }}
                  className="relative z-10"
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 mr-3 transition-colors duration-300',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400 drop-shadow-sm'
                        : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    )}
                  />
                </motion.div>
                <div className="relative z-10">
                  <motion.div 
                    className="font-semibold"
                    animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                  >
                    {item.name}
                  </motion.div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute right-3 w-2 h-2 bg-primary-500 rounded-full shadow-glow"
                  />
                )}
              </NavLink>
            </motion.div>
          )
        })}
      </nav>

      {/* Enhanced Connection Status */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-3 py-4 border-t border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-700/50"
      >
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-600/30 transition-colors duration-200"
        >
          <motion.div
            animate={isConnected ? 
              { scale: [1, 1.2, 1], boxShadow: ["0 0 0 0px rgba(34, 197, 94, 0.4)", "0 0 0 6px rgba(34, 197, 94, 0.1)", "0 0 0 0px rgba(34, 197, 94, 0)"] } : 
              { scale: [1, 1.1, 1] }
            }
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              'w-3 h-3 rounded-full shadow-sm',
              isConnected
                ? 'bg-success-500 shadow-success-400/50'
                : 'bg-danger-500 shadow-danger-400/50 animate-pulse'
            )}
          />
          <div>
            <motion.p 
              animate={{ color: isConnected ? "#16a34a" : "#dc2626" }}
              className="text-sm font-semibold"
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </motion.p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Backend API
            </p>
          </div>
          {isConnected && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              className="ml-auto"
            >
              <CheckCircle className="w-4 h-4 text-success-500" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Enhanced Version Info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-gray-50/30 to-transparent dark:from-gray-700/30"
      >
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex justify-between items-center px-3 py-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-600/30 transition-colors duration-200"
        >
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
            <span className="font-semibold">Regulated Edition</span>
          </div>
          <motion.span 
            whileHover={{ scale: 1.1 }}
            className="font-mono font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-1 rounded-md"
          >
            v1.1.0
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>
    </>
  )
}

export default Sidebar