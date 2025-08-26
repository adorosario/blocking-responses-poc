import React, { useMemo, useEffect, useState } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { apiClient } from '@/utils/api'
import { AuditEvent } from '@/types'

interface MetricsDataPoint {
  timestamp: string
  requests: number
  blocked: number
  blockRate: number
  avgRiskScore: number
  processingTime: number
}

const MetricsChart: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch audit logs on component mount and periodically
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await apiClient.getAuditLogs(200) // Get more logs for better chart
        if (response.success && response.data) {
          setAuditLogs(response.data.logs)
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAuditLogs()
    
    // Update every 30 seconds
    const interval = setInterval(fetchAuditLogs, 30000)
    return () => clearInterval(interval)
  }, [])

  // Process audit logs into time-based chart data
  const chartData: MetricsDataPoint[] = useMemo(() => {
    if (auditLogs.length === 0) {
      return []
    }

    // Group audit logs by time intervals (1-minute windows)
    const timeWindows = new Map<string, { requests: number; blocked: number; totalProcessingTime: number }>()
    
    auditLogs.forEach((log) => {
      const logTime = new Date(log.timestamp)
      // Round to 1-minute intervals
      const roundedMinutes = Math.floor(logTime.getMinutes() / 1) * 1
      const windowTime = new Date(logTime)
      windowTime.setMinutes(roundedMinutes, 0, 0) // Set seconds and milliseconds to 0
      
      const timeKey = windowTime.toISOString()
      
      if (!timeWindows.has(timeKey)) {
        timeWindows.set(timeKey, { requests: 0, blocked: 0, totalProcessingTime: 0 })
      }
      
      const window = timeWindows.get(timeKey)!
      window.requests += 1
      if (log.blocked) {
        window.blocked += 1
      }
      // Note: processing_time_ms might not be in AuditEvent type but exists in actual data
      window.totalProcessingTime += (log as any).processing_time_ms || 0
    })

    // Convert to chart data format and sort by time
    const chartPoints = Array.from(timeWindows.entries())
      .map(([timeKey, window]) => {
        const date = new Date(timeKey)
        const timeString = date.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit',
          minute: '2-digit'
        })
        
        return {
          timestamp: timeString,
          requests: window.requests,
          blocked: window.blocked,
          blockRate: window.requests > 0 ? (window.blocked / window.requests) * 100 : 0,
          avgRiskScore: 0, // We could calculate this from audit logs if needed
          processingTime: window.requests > 0 ? window.totalProcessingTime / window.requests : 0,
        }
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(-15) // Show last 15 time windows (15 minutes of data)

    return chartPoints
  }, [auditLogs])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${
                entry.name === 'Block Rate' 
                  ? `${entry.value.toFixed(1)}%`
                  : entry.name === 'Processing Time'
                  ? `${entry.value}ms`
                  : entry.name === 'Avg Risk Score'
                  ? entry.value.toFixed(2)
                  : entry.value
              }`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-64">
      {loading ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <p className="text-sm">Loading request data...</p>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <p className="text-sm">No request data available yet</p>
            <p className="text-xs mt-1">Charts will appear when requests are processed</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="requests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="blocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              opacity={0.2} 
            />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#requests)"
              strokeWidth={2}
              name="Requests"
            />
            <Area
              type="monotone"
              dataKey="blocked"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#blocked)"
              strokeWidth={2}
              name="Blocked"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default MetricsChart