import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDashboardStore } from '@/stores/dashboard'
import { applyTheme } from '@/utils'
import { NotificationProvider } from '@/components/ui/Notifications'
import Layout from '@/components/Layout'
import Dashboard from '@/components/pages/Dashboard'
import TestSuite from '@/components/pages/TestSuite'
import StreamMonitor from '@/components/pages/StreamMonitor'
import AuditLogs from '@/components/pages/AuditLogs'

const App: React.FC = () => {
  const { theme } = useDashboardStore()

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Watch for system theme changes when using 'system' theme
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return (
    <NotificationProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="h-screen bg-gray-50 dark:bg-gray-900"
      >
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/testing" element={<TestSuite />} />
            <Route path="/stream" element={<StreamMonitor />} />
            <Route path="/audit" element={<AuditLogs />} />
          </Routes>
        </Layout>
      </motion.div>
    </NotificationProvider>
  )
}

export default App