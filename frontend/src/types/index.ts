// Core API types
export interface ComplianceResult {
  score: number
  blocked: boolean
  triggered_patterns: string[]
  detected_entities: DetectedEntity[]
  total_score: number
  compliance_type?: string
  assessment_id?: string
}

export interface DetectedEntity {
  entity_type: string
  score: number
  start: number
  end: number
  text?: string
}

export interface StreamEvent {
  type: 'token' | 'assessment' | 'block' | 'completion' | 'heartbeat' | 'error'
  data: any
  timestamp: string
  trace_id?: string
}

export interface TestResult {
  test_name: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  duration?: number
  details?: any
  error?: string
  timestamp: string
}

export interface TestSuite {
  id: string
  name: string
  description: string
  tests: TestResult[]
  status: 'idle' | 'running' | 'completed'
  started_at?: string
  completed_at?: string
  total_tests: number
  passed_tests: number
  failed_tests: number
}

// Compliance types
export type ComplianceType = 'HIPAA' | 'PCI_DSS' | 'GDPR' | 'CCPA' | 'PII' | 'PHI'

export interface CompliancePattern {
  name: string
  category: ComplianceType
  pattern: string
  weight: number
  description: string
  examples: string[]
}

export interface ComplianceConfig {
  threshold: number
  enable_presidio: boolean
  presidio_confidence: number
  regional_weights: Record<string, Record<string, number>>
}

// Dashboard state types
export interface MetricsSummary {
  total_requests: number
  blocked_requests: number
  block_rate: number
  avg_risk_score: number
  max_risk_score: number
  input_windows_analyzed: number
  response_windows_analyzed: number
  pattern_detections: Record<string, number>
  presidio_detections: Record<string, number>
  performance_metrics: PerformanceMetrics
}

export interface PerformanceMetrics {
  avg_processing_time: number
  avg_response_time: number
  requests_per_second: number
  error_rate: number
}

// Real-time event types
export interface LiveStreamData {
  session_id: string
  tokens: TokenData[]
  current_buffer: string
  risk_assessments: ComplianceResult[]
  decisions: StreamDecision[]
  status: 'streaming' | 'blocked' | 'completed' | 'error'
}

export interface TokenData {
  token: string
  timestamp: string
  risk_score: number
  patterns_triggered: string[]
  cumulative_score: number
}

export interface StreamDecision {
  timestamp: string
  decision: 'allow' | 'block' | 'assess'
  reason: string
  risk_score: number
  patterns: string[]
  context_window: string
}

// Audit log types
export interface AuditEvent {
  id: string
  timestamp: string
  event_type: string
  session_id: string
  user_id?: string
  compliance_type: ComplianceType
  risk_score: number
  blocked: boolean
  patterns_detected: string[]
  entities_detected: DetectedEntity[]
  decision_reason: string
  content_hash?: string
  metadata: Record<string, any>
}

// WebSocket event types
export interface WebSocketEvent {
  type: string
  payload: any
  timestamp: string
  session_id?: string
  trace_id?: string
}

// UI State types
export interface DashboardState {
  activeView: 'dashboard' | 'testing' | 'stream' | 'audit'
  theme: 'light' | 'dark' | 'system'
  selectedComplianceType: ComplianceType
  testSuiteResults: TestSuite[]
  liveStream: LiveStreamData | null
  realtimeMetrics: MetricsSummary
  historicalMetrics: HistoricalMetricPoint[]
  auditEvents: AuditEvent[]
  isConnected: boolean
  lastUpdate: string
  testOutput: string
}

// Notification types
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
}

// Historical metrics for charts
export interface HistoricalMetricPoint {
  timestamp: string
  total_requests: number
  blocked_requests: number
  block_rate: number
  avg_risk_score: number
  avg_processing_time: number
  requests_per_second: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}