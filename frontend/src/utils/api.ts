import { ApiResponse, ComplianceResult, TestSuite, MetricsSummary, ComplianceConfig, CompliancePattern, AuditEvent } from '@/types'

const API_BASE_URL = '/api'

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle different content types
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const data = await response.json()
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        }
      } else {
        const text = await response.text()
        return {
          success: true,
          data: text as any,
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Health and system endpoints
  async getHealth() {
    return this.request<{ status: string; version: string; dependencies: any }>('/health')
  }

  async getMetrics() {
    return this.request<MetricsSummary>('/metrics')
  }

  async getConfig() {
    return this.request<ComplianceConfig>('/config')
  }

  // Compliance endpoints
  async assessRisk(text: string, options: {
    compliance_type?: string
    threshold?: number
  } = {}) {
    const params = new URLSearchParams({ text })
    if (options.compliance_type) {
      params.append('compliance_type', options.compliance_type)
    }
    if (options.threshold !== undefined) {
      params.append('threshold', options.threshold.toString())
    }
    return this.request<ComplianceResult>(`/assess-risk?${params}`)
  }

  async getCompliancePatterns() {
    return this.request<Record<string, CompliancePattern[]>>('/compliance/patterns')
  }

  async getComplianceConfig() {
    return this.request<ComplianceConfig>('/compliance/config')
  }

  async safeRewrite(data: {
    text: string
    compliance_type: string
    rewrite_style?: string
  }) {
    return this.request<{ rewritten_text: string; original_violations: string[] }>(
      '/compliance/safe-rewrite',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Testing endpoints
  async runTestSuite(suiteNames?: string[]) {
    return this.request<{ 
      session_id: string; 
      status: string; 
      output?: string;
      summary?: {
        passed: number;
        failed: number;
        total: number;
      }
    }>(
      '/test/run',
      {
        method: 'POST',
        body: JSON.stringify({ suites: suiteNames }),
      }
    )
  }

  async getTestResults(sessionId: string) {
    return this.request<TestSuite>(`/test/results/${sessionId}`)
  }

  async getAllTestSuites() {
    return this.request<{
      suites: Array<{
        id: string;
        name: string;
        description: string;
        tests: number;
        status: string;
        passed: number;
        failed: number;
      }>
    }>('/test/suites')
  }

  // Simple audit logs endpoint
  async getAuditLogs(limit: number = 100) {
    return this.request<{
      logs: AuditEvent[]
      count: number
      total_available: number
    }>(`/audit-logs?limit=${limit}`)
  }

  // Compliance audit logs with filters
  async getComplianceAuditLogs(filters: {
    limit?: number
    offset?: number
    compliance_type?: string
    blocked_only?: boolean
    start_date?: string
    end_date?: string
  } = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString())
      }
    })
    
    return this.request<{
      logs: AuditEvent[]
      count: number
      total_available: number
    }>(`/audit-logs?${params}`)
  }

  // Streaming endpoints
  async startStream(data: {
    message: string
    model?: string
    compliance_type?: string
    threshold?: number
    api_key?: string
  }) {
    return this.request<{ session_id: string; stream_url: string }>(
      '/chat/stream',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Export utilities
  async exportAuditReport(filters: any, format: 'json' | 'csv' = 'json') {
    const params = new URLSearchParams({
      ...filters,
      format,
    })
    
    const response = await fetch(`${API_BASE_URL}/compliance/export?${params}`)
    if (!response.ok) {
      throw new Error('Export failed')
    }
    
    return response.blob()
  }

  // Utility methods
  createEventSource(endpoint: string): EventSource {
    return new EventSource(`${API_BASE_URL}${endpoint}`)
  }

  async pingConnection(): Promise<boolean> {
    try {
      const response = await this.getHealth()
      return response.success
    } catch {
      return false
    }
  }
}

export const apiClient = new ApiClient()
export default apiClient