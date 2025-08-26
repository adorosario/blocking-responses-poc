import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import { useDashboardStore } from '@/stores/dashboard'
import { useConnection } from '@/utils/useConnection'
import { apiClient } from '@/utils/api'
import { notificationManager } from '@/utils/notifications'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { updateMetrics, addHistoricalMetric, realtimeMetrics } = useDashboardStore()
  const connectionStatus = useConnection()
  const location = useLocation()
  const prevMetricsRef = React.useRef(realtimeMetrics)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  
  // Check if we're on the stream monitor page
  const isStreamMonitor = location.pathname === '/stream'

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Global metrics loading - ensures header always has current data
  useEffect(() => {
    if (!connectionStatus) return

    const fetchGlobalMetrics = async () => {
      try {
        const metricsResponse = await apiClient.getMetrics()
        if (metricsResponse.success && metricsResponse.data) {
          const newMetrics = metricsResponse.data
          const prevMetrics = prevMetricsRef.current
          
          // Check for significant changes and create notifications
          if (prevMetrics.total_requests > 0) { // Only if we have previous data
            // High block rate notification
            if (newMetrics.block_rate > 20 && prevMetrics.block_rate <= 20) {
              notificationManager.onHighBlockRate(newMetrics.block_rate)
            }
            
            // New blocked requests notification
            if (newMetrics.blocked_requests > prevMetrics.blocked_requests) {
              const newBlocked = newMetrics.blocked_requests - prevMetrics.blocked_requests
              if (newBlocked >= 5) { // Only notify for significant increases
                notificationManager.addNotification({
                  type: 'warning',
                  title: 'Multiple Requests Blocked',
                  message: `${newBlocked} additional requests have been blocked due to compliance violations.`
                })
              }
            }
          }
          
          updateMetrics(newMetrics)
          
          // Add historical metric point for charts
          const historicalPoint = {
            timestamp: new Date().toISOString(),
            total_requests: newMetrics.total_requests,
            blocked_requests: newMetrics.blocked_requests,
            block_rate: newMetrics.block_rate,
            avg_risk_score: newMetrics.avg_risk_score,
            avg_processing_time: newMetrics.performance_metrics.avg_processing_time,
            requests_per_second: newMetrics.performance_metrics.requests_per_second,
          }
          addHistoricalMetric(historicalPoint)
          
          prevMetricsRef.current = newMetrics
        }
      } catch (error) {
        console.error('Failed to fetch global metrics:', error)
        notificationManager.addNotification({
          type: 'error',
          title: 'Connection Issue',
          message: 'Failed to fetch latest metrics from the server.'
        })
      }
    }

    // Initial fetch
    fetchGlobalMetrics()

    // Set up periodic refresh - more frequent for better chart granularity
    const interval = setInterval(fetchGlobalMetrics, 10000) // Every 10 seconds for smoother charts

    return () => clearInterval(interval)
  }, [connectionStatus, updateMetrics])

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 flex overflow-hidden">
      {/* Fixed Sidebar */}
      <div className="flex-shrink-0">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      </div>
      
      {/* Main Content Area - Fixed Height Layout */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <Header onMobileMenuToggle={toggleMobileMenu} />
        </div>
        
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              duration: 0.4,
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className={isStreamMonitor ? "h-full" : "h-full px-3 sm:px-6 py-4 sm:py-6 lg:py-8"}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Fixed Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-80 w-80 h-80 bg-gradient-to-br from-primary-400/20 to-success-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-80 w-96 h-96 bg-gradient-to-br from-warning-400/20 to-danger-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-gradient-to-br from-success-400/10 to-primary-400/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '4s' }} />
      </div>
    </div>
  )
}

export default Layout