import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Eye,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, ComplianceBadge, RiskBadge } from '@/components/ui/Badge'
import { useNotifications } from '@/components/ui/Notifications'
import { formatters } from '@/utils'
import { useConnection } from '@/utils/useConnection'
import { apiClient } from '@/utils/api'
import { AuditEvent } from '@/types'

const AuditLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedComplianceType, setSelectedComplianceType] = useState('all')
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showDateModal, setShowDateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: '',
    end: ''
  })
  const [tempDateRange, setTempDateRange] = useState<{start: string, end: string}>({
    start: '',
    end: ''
  })
  
  const [searchParams, setSearchParams] = useSearchParams()
  const isConnected = useConnection()
  const { success, error: notifyError, info } = useNotifications()

  useEffect(() => {
    loadAuditLogs()
  }, [isConnected])

  // Check for eventId in URL params and auto-open details
  useEffect(() => {
    const eventId = searchParams.get('eventId')
    if (eventId && auditEvents.length > 0) {
      const targetEvent = auditEvents.find(event => event.id === eventId)
      if (targetEvent) {
        setSelectedEvent(targetEvent)
        setShowDetailsModal(true)
        // Remove the eventId from URL after opening
        searchParams.delete('eventId')
        setSearchParams(searchParams)
      }
    }
  }, [auditEvents, searchParams, setSearchParams])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !isConnected) return
    
    const interval = setInterval(() => {
      loadAuditLogs()
    }, 10000) // Refresh every 10 seconds
    
    return () => clearInterval(interval)
  }, [autoRefresh, isConnected])

  const loadAuditLogs = async () => {
    if (!isConnected) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await apiClient.getComplianceAuditLogs({
        limit: 50,
        offset: 0,
        compliance_type: selectedComplianceType === 'all' ? undefined : selectedComplianceType,
      })
      
      if (response.success && response.data) {
        // Map the backend audit log format to frontend AuditEvent format
        const mappedEvents: AuditEvent[] = (response.data.logs || []).map((event: any) => ({
          id: event.id.toString(),
          timestamp: event.timestamp,
          event_type: event.event_type || 'UNKNOWN',
          session_id: event.session_id || '',
          compliance_type: event.compliance_type || 'PII',
          risk_score: event.risk_score || 0,
          blocked: event.blocked || false,
          patterns_detected: event.patterns_detected || [],
          entities_detected: event.entities_detected || [],
          decision_reason: event.decision_reason || (event.blocked ? 
            'Content blocked due to compliance violations' : 
            'Content processed successfully - no violations detected'),
          content_hash: event.content_hash,
          metadata: event.details || {}
        }))
        
        setAuditEvents(mappedEvents)
      } else {
        setError(response.error || 'Failed to load audit logs')
      }
    } catch (err) {
      setError('Failed to connect to audit log service')
      console.error('Error loading audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = auditEvents.filter(event => {
    const searchLower = searchTerm.toLowerCase()
    
    // Search across multiple fields (only filter if search term exists)
    const matchesSearch = !searchTerm || 
      event.decision_reason.toLowerCase().includes(searchLower) ||
      event.patterns_detected.some(p => p.toLowerCase().includes(searchLower)) ||
      event.entities_detected.some(e => {
        const entityType = typeof e === 'string' ? e : (e?.entity_type || '')
        return entityType.toLowerCase().includes(searchLower)
      }) ||
      event.event_type.toLowerCase().includes(searchLower) ||
      event.session_id.toLowerCase().includes(searchLower) ||
      event.compliance_type.toLowerCase().includes(searchLower) ||
      (event.content_hash && event.content_hash.toLowerCase().includes(searchLower)) ||
      event.risk_score.toString().includes(searchTerm)
    
    const matchesCompliance = selectedComplianceType === 'all' || 
      event.compliance_type === selectedComplianceType

    // Date filtering
    const matchesDateRange = (() => {
      if (!dateRange.start || !dateRange.end) return true
      
      const eventDate = new Date(event.timestamp)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      
      // Set end date to end of day for inclusive filtering
      endDate.setHours(23, 59, 59, 999)
      
      return eventDate >= startDate && eventDate <= endDate
    })()

    return matchesSearch && matchesCompliance && matchesDateRange
  })

  const handleRefresh = () => {
    loadAuditLogs()
  }

  const handleComplianceTypeChange = (value: string) => {
    setSelectedComplianceType(value)
    // Optionally reload with new filter
  }

  const handleExportCSV = () => {
    try {
      const headers = [
        'ID', 'Timestamp', 'Event Type', 'Session ID', 'Compliance Type', 
        'Risk Score', 'Status', 'Patterns Detected', 'Entities Detected', 
        'Decision Reason', 'Content Hash'
      ]
      
      const rows = filteredEvents.map(event => [
        event.id,
        event.timestamp,
        event.event_type.replace(/_/g, ' '),
        event.session_id,
        event.compliance_type,
        event.risk_score.toFixed(2),
        event.blocked ? 'BLOCKED' : 'ALLOWED',
        event.patterns_detected.join('; '),
        event.entities_detected.map(e => {
          if (typeof e === 'string') return e
          const entityType = e?.entity_type || 'Unknown'
          const score = e?.score ? (e.score * 100).toFixed(0) : '0'
          return `${entityType} (${score}%)`
        }).join('; '),
        event.decision_reason,
        event.content_hash || ''
      ])
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      success('Export Complete', `Exported ${filteredEvents.length} audit events to CSV`)
    } catch (err) {
      notifyError('Export Failed', 'Failed to export audit logs')
    }
  }

  const handleDateRange = () => {
    setShowDateModal(true)
  }

  const applyDateRange = () => {
    setDateRange(tempDateRange)
    setShowDateModal(false)
    info('Date Range Applied', `Filtering events from ${tempDateRange.start} to ${tempDateRange.end}`)
    loadAuditLogs()
  }

  const clearDateRange = () => {
    setDateRange({ start: '', end: '' })
    setTempDateRange({ start: '', end: '' })
    info('Date Filter Cleared', 'Showing all events')
  }

  const handleViewDetails = (event: AuditEvent) => {
    setSelectedEvent(event)
    setShowDetailsModal(true)
  }

  const handleLoadMore = async () => {
    if (!isConnected || loading) return
    
    setLoading(true)
    try {
      const newOffset = auditEvents.length
      const response = await apiClient.getComplianceAuditLogs({
        limit: 50,
        offset: newOffset,
        compliance_type: selectedComplianceType === 'all' ? undefined : selectedComplianceType,
      })
      
      if (response.success && response.data) {
        const newEvents: AuditEvent[] = (response.data.logs || []).map((event: any) => ({
          id: event.id.toString(),
          timestamp: event.timestamp,
          event_type: event.event_type || 'UNKNOWN',
          session_id: event.session_id || '',
          compliance_type: event.compliance_type || 'PII',
          risk_score: event.risk_score || 0,
          blocked: event.blocked || false,
          patterns_detected: event.patterns_detected || [],
          entities_detected: event.entities_detected || [],
          decision_reason: event.decision_reason || (event.blocked ? 
            'Content blocked due to compliance violations' : 
            'Content processed successfully - no violations detected'),
          content_hash: event.content_hash,
          metadata: event.details || {}
        }))
        
        setAuditEvents(prev => [...prev, ...newEvents])
        setHasMore((response.data.logs?.length || 0) >= 50) // More available if we got a full page
        
        if (newEvents.length > 0) {
          success('Loaded More Events', `Loaded ${newEvents.length} additional audit events`)
        } else {
          info('No More Events', 'All available audit events have been loaded')
        }
      }
    } catch (err) {
      notifyError('Load Error', 'Failed to load more audit events')
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (event: any) => {
    if (event.blocked) {
      return <Shield className="w-5 h-5 text-danger-600" />
    } else if (event.risk_score > 0.7) {
      return <AlertTriangle className="w-5 h-5 text-warning-600" />
    } else {
      return <CheckCircle className="w-5 h-5 text-success-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Audit Logs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive compliance audit trail and event history
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
            className="flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button 
            variant={autoRefresh ? "primary" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">
              {autoRefresh ? '⏸️ Stop Auto' : '🔄 Auto Refresh'}
            </span>
            <span className="sm:hidden">
              {autoRefresh ? '⏸️' : '🔄'}
            </span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || filteredEvents.length === 0}
            className="flex-shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDateRange}
            className="flex-shrink-0"
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Date Range</span>
          </Button>
          {(dateRange.start || dateRange.end) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearDateRange}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
            >
              <X className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Clear Filter</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-800 dark:text-red-200 font-medium">
              {error}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              className="ml-auto"
            >
              Try Again
            </Button>
          </div>
        </motion.div>
      )}

      {/* Connection Status Warning */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-amber-800 dark:text-amber-200 font-medium">
              Connection to backend API is unavailable. Some features may be limited.
            </span>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by event type, session ID, patterns, entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  {searchTerm && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                {searchTerm && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                    💡 Try searching for: "blocked", "PERSON", "email", "high risk", session IDs, or compliance types
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Compliance Type Filter */}
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <select
                    value={selectedComplianceType}
                    onChange={(e) => handleComplianceTypeChange(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm min-w-0"
                  >
                    <option value="all">All Types</option>
                    <option value="HIPAA">HIPAA</option>
                    <option value="PCI_DSS">PCI DSS</option>
                    <option value="GDPR">GDPR</option>
                    <option value="CCPA">CCPA</option>
                    <option value="PII">PII</option>
                    <option value="PHI">PHI</option>
                  </select>
                </div>

                {/* Results Count */}
                <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {loading ? 'Loading...' : `${filteredEvents.length} events`}
                  {(dateRange.start || dateRange.end) && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400 hidden lg:inline">
                      • Date filtered: {dateRange.start} to {dateRange.end}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Events List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading audit events...</span>
              </div>
            </CardContent>
          </Card>
        ) : filteredEvents.length > 0 ? (
          filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card hover>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                    {/* Event Icon */}
                    <div className="flex-shrink-0 sm:mt-1">
                      {getEventIcon(event)}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ComplianceBadge type={event.compliance_type} />
                          <RiskBadge score={event.risk_score} />
                          <Badge 
                            variant={event.blocked ? "danger" : "success"}
                            size="sm"
                          >
                            {event.blocked ? 'BLOCKED' : 'ALLOWED'}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 sm:flex-shrink-0">
                          {formatters.datetime(event.timestamp)}
                        </span>
                      </div>

                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm sm:text-base">
                        {event.event_type.replace(/_/g, ' ')} 
                        <span className="text-gray-500 dark:text-gray-400 font-normal ml-2 block sm:inline">
                          (Session: {event.session_id})
                        </span>
                      </h3>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {event.decision_reason}
                      </p>

                      {/* Detected Entities */}
                      {event.entities_detected.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            DETECTED ENTITIES
                          </h4>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {event.entities_detected.map((entity, idx) => {
                              const entityName = typeof entity === 'string' ? entity : (entity?.entity_type || 'Unknown')
                              const confidence = typeof entity === 'object' && entity?.score ? (entity.score * 100).toFixed(0) : '0'
                              
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400"
                                >
                                  {entityName}
                                  <span className="ml-1 text-blue-600 dark:text-blue-300">
                                    {confidence}%
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Detected Patterns */}
                      {event.patterns_detected.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            TRIGGERED PATTERNS
                          </h4>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {event.patterns_detected.map((pattern) => (
                              <span
                                key={pattern}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400"
                              >
                                {pattern.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 dark:text-gray-400 gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>Risk Score: {event.risk_score.toFixed(2)}</span>
                          {event.content_hash && (
                            <span className="hidden sm:inline">Hash: {event.content_hash}</span>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewDetails(event)}
                          className="self-start sm:self-center"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">Details</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-4">🔍</div>
                <p className="font-medium mb-2">No audit events found</p>
                <p className="text-sm">
                  {searchTerm || selectedComplianceType !== 'all' 
                    ? 'Try adjusting your search filters'
                    : 'Audit events will appear here as the system processes requests'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Load More */}
      {filteredEvents.length > 0 && !loading && hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Button 
            variant="outline"
            onClick={handleLoadMore}
          >
            Load More Events
          </Button>
        </motion.div>
      )}

      {/* Date Range Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-md border dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white p-4 border-b border-gray-200 dark:border-gray-700">
              Select Date Range
            </h3>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempDateRange.start}
                  onChange={(e) => setTempDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempDateRange.end}
                  onChange={(e) => setTempDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setShowDateModal(false)}
                className="order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={applyDateRange}
                disabled={!tempDateRange.start || !tempDateRange.end}
                className="order-1 sm:order-2"
              >
                Apply Filter
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Event Details Modal */}
      {showDetailsModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden border dark:border-gray-700"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Event Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event ID</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{selectedEvent.id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Session ID</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{selectedEvent.session_id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedEvent.event_type}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Timestamp</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {new Date(selectedEvent.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance & Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Compliance & Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Compliance Type</label>
                        <div className="mt-1">
                          <ComplianceBadge type={selectedEvent.compliance_type} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risk Score</label>
                        <div className="mt-1">
                          <RiskBadge score={selectedEvent.risk_score} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Blocked</label>
                        <div className="mt-1">
                          <Badge variant={selectedEvent.blocked ? 'danger' : 'success'}>
                            {selectedEvent.blocked ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content Hash</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                          {selectedEvent.content_hash || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Decision Reason */}
              <Card className="mt-4 sm:mt-6">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Decision Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedEvent.decision_reason}</p>
                </CardContent>
              </Card>

              {/* Entities Detected */}
              {selectedEvent.entities_detected.length > 0 && (
                <Card className="mt-4 sm:mt-6">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Entities Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedEvent.entities_detected.map((entity, index) => {
                        const entityName = typeof entity === 'string' ? entity : (entity?.entity_type || 'Unknown Entity')
                        const confidence = typeof entity === 'object' && entity?.score ? (entity.score * 100).toFixed(1) : '0.0'
                        
                        return (
                          <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {entityName}
                            </span>
                            <Badge variant="info">
                              {confidence}% confidence
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Patterns Detected */}
              {selectedEvent.patterns_detected.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Patterns Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.patterns_detected.map((pattern, index) => (
                        <Badge key={index} variant="warning">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AuditLogs