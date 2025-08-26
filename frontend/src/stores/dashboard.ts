import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { DashboardState, TestSuite, LiveStreamData, MetricsSummary, AuditEvent, ComplianceType, HistoricalMetricPoint } from '@/types'
import { storage } from '@/utils'

interface DashboardStore extends DashboardState {
  // Actions
  setActiveView: (view: DashboardState['activeView']) => void
  setTheme: (theme: DashboardState['theme']) => void
  setSelectedComplianceType: (type: ComplianceType) => void
  setIsConnected: (connected: boolean) => void
  
  // Test suite actions
  addTestSuite: (suite: TestSuite) => void
  updateTestSuite: (id: string, updates: Partial<TestSuite>) => void
  clearTestResults: () => void
  setTestOutput: (output: string) => void
  appendTestOutput: (output: string) => void
  clearTestOutput: () => void
  
  // Live stream actions
  setLiveStream: (stream: LiveStreamData | null) => void
  updateLiveStream: (updates: Partial<LiveStreamData>) => void
  
  // Metrics actions
  updateMetrics: (metrics: Partial<MetricsSummary>) => void
  addHistoricalMetric: (metric: HistoricalMetricPoint) => void
  clearHistoricalMetrics: () => void
  
  // Audit actions
  addAuditEvents: (events: AuditEvent[]) => void
  setAuditEvents: (events: AuditEvent[]) => void
  clearAuditEvents: () => void
  
  // Utility actions
  updateLastUpdate: () => void
}

const initialState: DashboardState = {
  activeView: 'dashboard',
  theme: (storage.get<'light' | 'dark' | 'system'>('theme') || 'system'),
  selectedComplianceType: 'PII',
  testSuiteResults: [],
  liveStream: null,
  realtimeMetrics: {
    total_requests: 0,
    blocked_requests: 0,
    block_rate: 0,
    avg_risk_score: 0,
    max_risk_score: 0,
    input_windows_analyzed: 0,
    response_windows_analyzed: 0,
    pattern_detections: {},
    presidio_detections: {},
    performance_metrics: {
      avg_processing_time: 0,
      avg_response_time: 0,
      requests_per_second: 0,
      error_rate: 0,
    },
  },
  historicalMetrics: [],
  auditEvents: [],
  isConnected: false,
  lastUpdate: new Date().toISOString(),
  testOutput: '',
}

export const useDashboardStore = create<DashboardStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      ...initialState,
      
      // View and theme actions
      setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),
      
      setTheme: (theme) => {
        storage.set('theme', theme)
        set({ theme }, false, 'setTheme')
      },
      
      setSelectedComplianceType: (type) => 
        set({ selectedComplianceType: type }, false, 'setSelectedComplianceType'),
      
      setIsConnected: (connected) =>
        set({ isConnected: connected }, false, 'setIsConnected'),
      
      // Test suite actions
      addTestSuite: (suite) =>
        set(
          (state) => ({
            testSuiteResults: [...state.testSuiteResults, suite],
          }),
          false,
          'addTestSuite'
        ),
      
      updateTestSuite: (id, updates) =>
        set(
          (state) => ({
            testSuiteResults: state.testSuiteResults.map((suite) =>
              suite.id === id ? { ...suite, ...updates } : suite
            ),
          }),
          false,
          'updateTestSuite'
        ),
      
      clearTestResults: () =>
        set({ testSuiteResults: [] }, false, 'clearTestResults'),
      
      // Test output actions
      setTestOutput: (output) =>
        set({ testOutput: output }, false, 'setTestOutput'),
      
      appendTestOutput: (output) =>
        set(
          (state) => ({
            testOutput: state.testOutput + output,
          }),
          false,
          'appendTestOutput'
        ),
      
      clearTestOutput: () =>
        set({ testOutput: '' }, false, 'clearTestOutput'),
      
      // Live stream actions
      setLiveStream: (stream) =>
        set({ liveStream: stream }, false, 'setLiveStream'),
      
      updateLiveStream: (updates) =>
        set(
          (state) => ({
            liveStream: state.liveStream
              ? { ...state.liveStream, ...updates }
              : null,
          }),
          false,
          'updateLiveStream'
        ),
      
      // Metrics actions
      updateMetrics: (metrics) =>
        set(
          (state) => ({
            realtimeMetrics: { ...state.realtimeMetrics, ...metrics },
          }),
          false,
          'updateMetrics'
        ),

      addHistoricalMetric: (metric) =>
        set(
          (state) => {
            const newHistoricalMetrics = [metric, ...state.historicalMetrics]
            // Keep more data points for better chart visualization (about 30 minutes at 10-second intervals)
            return {
              historicalMetrics: newHistoricalMetrics.slice(0, 180)
            }
          },
          false,
          'addHistoricalMetric'
        ),

      clearHistoricalMetrics: () =>
        set({ historicalMetrics: [] }, false, 'clearHistoricalMetrics'),
      
      // Audit actions
      addAuditEvents: (events) =>
        set(
          (state) => {
            // Deduplicate events by ID to prevent duplicates
            const existingIds = new Set(state.auditEvents.map(e => e.id))
            const newEvents = events.filter(e => !existingIds.has(e.id))
            
            return {
              auditEvents: [...newEvents, ...state.auditEvents].slice(0, 1000), // Keep last 1000 events
            }
          },
          false,
          'addAuditEvents'
        ),
      
      setAuditEvents: (events) =>
        set({ auditEvents: events.slice(0, 1000) }, false, 'setAuditEvents'),
      
      clearAuditEvents: () =>
        set({ auditEvents: [] }, false, 'clearAuditEvents'),
      
      // Utility actions
      updateLastUpdate: () =>
        set({ lastUpdate: new Date().toISOString() }, false, 'updateLastUpdate'),
    })),
    {
      name: 'dashboard-store',
    }
  )
)

// Selectors for computed values
export const useTestSuiteStats = () =>
  useDashboardStore((state) => {
    const suites = state.testSuiteResults
    const totalSuites = suites.length
    const completedSuites = suites.filter((s) => s.status === 'completed').length
    const runningSuites = suites.filter((s) => s.status === 'running').length
    const totalTests = suites.reduce((acc, s) => acc + s.total_tests, 0)
    const passedTests = suites.reduce((acc, s) => acc + s.passed_tests, 0)
    const failedTests = suites.reduce((acc, s) => acc + s.failed_tests, 0)
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0
    
    return {
      totalSuites,
      completedSuites,
      runningSuites,
      totalTests,
      passedTests,
      failedTests,
      successRate,
    }
  })

export const useRecentAuditEvents = (limit: number = 10) =>
  useDashboardStore((state) => state.auditEvents.slice(0, limit))

export const useComplianceStats = () =>
  useDashboardStore((state) => {
    const events = state.auditEvents
    const totalEvents = events.length
    const blockedEvents = events.filter((e) => e.blocked).length
    const blockRate = totalEvents > 0 ? (blockedEvents / totalEvents) * 100 : 0
    
    // Group by compliance type
    const byComplianceType = events.reduce((acc, event) => {
      const type = event.compliance_type
      if (!acc[type]) {
        acc[type] = { total: 0, blocked: 0 }
      }
      acc[type].total++
      if (event.blocked) {
        acc[type].blocked++
      }
      return acc
    }, {} as Record<string, { total: number; blocked: number }>)
    
    // Group by pattern
    const byPattern = events.reduce((acc, event) => {
      event.patterns_detected.forEach((pattern) => {
        if (!acc[pattern]) {
          acc[pattern] = 0
        }
        acc[pattern]++
      })
      return acc
    }, {} as Record<string, number>)
    
    return {
      totalEvents,
      blockedEvents,
      blockRate,
      byComplianceType,
      byPattern,
    }
  })