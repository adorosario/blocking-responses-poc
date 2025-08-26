import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useComplianceStats } from '@/stores/dashboard'

const ComplianceBreakdown: React.FC = () => {
  const complianceStats = useComplianceStats()
  
  // Prepare data for pie chart
  const pieData = Object.entries(complianceStats.byComplianceType).map(([type, stats]) => ({
    name: type,
    value: stats.total,
    blocked: stats.blocked,
    color: getComplianceColors(type),
  }))

  // Prepare data for bar chart (top patterns)
  const barData = Object.entries(complianceStats.byPattern)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([pattern, count]) => ({
      name: pattern.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
    }))

  function getComplianceColors(type: string) {
    const colors: Record<string, string> = {
      HIPAA: '#06b6d4',
      PCI_DSS: '#8b5cf6',
      GDPR: '#10b981',
      CCPA: '#f59e0b',
      PII: '#3b82f6',
      PHI: '#6366f1',
    }
    return colors[type] || '#6b7280'
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {data.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total: {data.value || data.count}
          </p>
          {data.blocked !== undefined && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Blocked: {data.blocked}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (pieData.length === 0) {
    return (
      <div className="h-60 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <p>No compliance data available yet</p>
          <p className="text-sm">Run some tests to see breakdown</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Compliance Types Pie Chart */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">
          By Compliance Type
        </h4>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={window.innerWidth < 640 ? 70 : 100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-3 sm:mt-4">
          {pieData.map((entry, index) => (
            <div key={index} className="flex items-center space-x-1 sm:space-x-2">
              <div 
                className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Patterns Bar Chart */}
      {barData.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">
            Top Detection Patterns
          </h4>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="patternGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: window.innerWidth < 640 ? 10 : 11 }}
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                  stroke="#6b7280"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill="url(#patternGradient)"
                  radius={[4, 4, 0, 0]}
                  stroke="#2563eb"
                  strokeWidth={1}
                  minPointSize={5}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComplianceBreakdown