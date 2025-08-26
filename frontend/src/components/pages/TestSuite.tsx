import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Download,
  Settings,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useNotifications } from '@/components/ui/Notifications'
import { useConnection } from '@/utils/useConnection'
import { useDashboardStore } from '@/stores/dashboard'
import { apiClient } from '@/utils/api'

// Status badge component
const StatusBadge: React.FC<{ status: string; animate?: boolean }> = ({ status, animate }) => {
  const getVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'running':
        return 'info'
      case 'failed':
        return 'danger'
      case 'pending':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <Badge variant={getVariant(status)} className={animate ? 'animate-pulse' : ''}>
      {status}
    </Badge>
  )
}

const TestSuite: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false)
  const { success, error } = useNotifications()
  const { testOutput, setTestOutput, appendTestOutput, clearTestOutput } = useDashboardStore()
  const [testSuites, setTestSuites] = useState<any[]>([
    {
      id: 'basic',
      name: 'Basic Functionality', 
      description: 'Core API endpoints and health checks',
      tests: 3,
      status: 'completed',
      passed: 3,
      failed: 0,
    },
    {
      id: 'patterns',
      name: 'Pattern Detection',
      description: 'Regex pattern detection accuracy', 
      tests: 4,
      status: 'completed',
      passed: 4,
      failed: 0,
    },
    {
      id: 'presidio',
      name: 'Presidio Integration',
      description: 'Microsoft Presidio ML detection',
      tests: 3,
      status: 'running',
      passed: 2,
      failed: 0,
    },
    {
      id: 'streaming',
      name: 'SSE Streaming',
      description: 'Server-Sent Events and validation',
      tests: 3,
      status: 'pending',
      passed: 0,
      failed: 0,
    }
  ])
  const [runningTests, setRunningTests] = useState<string[]>([])
  const [pollingInterval, setPollingInterval] = useState<number | null>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const isConnected = useConnection()

  // Load test suites on component mount
  useEffect(() => {
    loadTestSuites()
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [isConnected])

  // Start polling when tests are running
  useEffect(() => {
    if (runningTests.length > 0 || isRunning) {
      const interval = setInterval(() => {
        loadTestSuites()
      }, 2000) // Poll every 2 seconds
      setPollingInterval(interval)
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [runningTests, isRunning])

  const loadTestSuites = async () => {
    if (!isConnected) return
    
    try {
      const response = await apiClient.getAllTestSuites()
      if (response.success && response.data) {
        setTestSuites(response.data.suites || [])
      }
    } catch (error) {
      console.error('Error loading test suites:', error)
    }
  }

  const handleRunTests = async () => {
    if (!isConnected) return
    
    setIsRunning(true)
    setTestOutput('🚀 Starting full test suite execution...\n')
    
    try {
      const response = await apiClient.runTestSuite(['basic', 'patterns', 'presidio', 'streaming'])
      if (response.success && response.data) {
        const data = response.data
        appendTestOutput(`✅ Test session started: ${data.session_id}\n`)
        appendTestOutput(`📊 Status: ${data.status}\n`)
        
        if (data.output) {
          appendTestOutput(`\n📝 Test Results:\n${data.output}\n`)
        }
        
        // Update test suites with results
        if (data.summary) {
          appendTestOutput(`\n📊 Summary: ${data.summary.passed}/${data.summary.total} tests passed\n`)
          
          // Update local test suites status based on results
          const summary = data.summary
          setTestSuites(prevSuites => 
            prevSuites.map(suite => ({
              ...suite,
              status: 'completed',
              passed: Math.floor(summary.passed / prevSuites.length), // Distribute results
              failed: Math.floor(summary.failed / prevSuites.length),
              total: Math.floor(summary.total / prevSuites.length)
            }))
          )
          
          success(
            'Tests Completed!',
            `Results: ${summary.passed}/${summary.total} tests passed`
          )
        }
        
        // Reload test suites to update status
        await loadTestSuites()
      } else {
        appendTestOutput(`❌ Error: ${response.error}\n`)
      }
    } catch (error) {
      appendTestOutput(`💥 Exception: ${error}\n`)
    } finally {
      setIsRunning(false)
    }
  }

  const handleRunSingleSuite = async (suiteId: string) => {
    if (!isConnected) return
    
    setRunningTests(prev => [...prev, suiteId])
    appendTestOutput(`🔄 Running ${suiteId} suite...\n`) // Append instead of clearing
    
    try {
      const response = await apiClient.runTestSuite([suiteId])
      if (response.success && response.data) {
        const data = response.data
        appendTestOutput(`✅ ${suiteId} completed: ${data.status}\n`)
        
        if (data.output) {
          appendTestOutput(`📝 ${suiteId} output:\n${data.output}\n`)
        }
        
        // Update specific suite with results
        if (data.summary) {
          appendTestOutput(`📊 ${suiteId} summary: ${data.summary.passed}/${data.summary.total} tests passed\n`)
          
          const summary = data.summary
          setTestSuites(prevSuites =>
            prevSuites.map(suite =>
              suite.id === suiteId
                ? {
                    ...suite,
                    status: 'completed',
                    passed: summary.passed,
                    failed: summary.failed,
                    total: summary.total
                  }
                : suite
            )
          )
          
          success(
            `${suiteId} Completed!`,
            `${summary.passed}/${summary.total} tests passed`
          )
        }
        
        // Reload test suites to update status
        await loadTestSuites()
      } else {
        appendTestOutput(`❌ Error running ${suiteId}: ${response.error}\n`)
        error(`${suiteId} Failed`, response.error || 'Unknown error')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      appendTestOutput(`💥 Exception running ${suiteId}: ${errorMsg}\n`)
      error(`${suiteId} Exception`, errorMsg)
    } finally {
      setRunningTests(prev => prev.filter(id => id !== suiteId))
    }
  }

    const handleDownloadTestResults = (format: 'csv' | 'json' | 'pdf') => {
    const generateCSV = (data: any[]) => {
      const headers = ['Test Suite', 'Status', 'Passed', 'Failed', 'Warnings', 'Total']
      const rows = data.map((suite: any) => [
        suite.name,
        suite.status,
        suite.passed.toString(),
        suite.failed.toString(),
        suite.warnings.toString(),
        suite.total.toString()
      ])
      
      const csvContent = [headers, ...rows]
        .map(row => row.map((field: any) => `"${field}"`).join(','))
        .join('\n')
      
      return csvContent
    }

    const generateJSON = (data: any[]) => {
      return JSON.stringify(data, null, 2)
    }

    const generatePDF = (data: any[]) => {
      // Simple PDF-like text format
      let content = 'TEST RESULTS REPORT\n'
      content += '==================\n\n'
      content += `Generated: ${new Date().toLocaleDateString()}\n\n`
      
      data.forEach((suite: any) => {
        content += `${suite.name}\n`
        content += `Status: ${suite.status}\n`
        content += `Passed: ${suite.passed}, Failed: ${suite.failed}, Warnings: ${suite.warnings}\n`
        content += `Total: ${suite.total}\n\n`
      })
      
      return content
    }

    try {
      const currentTestResults = testSuites.map(suite => ({
        name: suite.name,
        status: suite.status || 'Not Run',
        passed: suite.passed || 0,
        failed: suite.failed || 0,
        warnings: suite.warnings || 0,
        total: suite.total || suite.tests || 0
      }))

      let content: string
      let filename: string
      let mimeType: string

      switch (format) {
        case 'csv':
          content = generateCSV(currentTestResults)
          filename = `test-results-${new Date().toISOString().split('T')[0]}.csv`
          mimeType = 'text/csv'
          break
        case 'json':
          content = generateJSON(currentTestResults)
          filename = `test-results-${new Date().toISOString().split('T')[0]}.json`
          mimeType = 'application/json'
          break
        case 'pdf':
          content = generatePDF(currentTestResults)
          filename = `test-results-${new Date().toISOString().split('T')[0]}.txt`
          mimeType = 'text/plain'
          break
        default:
          throw new Error('Unsupported format')
      }

      const blob = new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      success('Download Complete', `Test results downloaded as ${filename}`)
    } catch (err) {
      console.error('Download failed:', err)
      error('Download Failed', 'Failed to download test results')
    }
  }

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [testConfig, setTestConfig] = useState({
    timeout: 60,
    verboseOutput: true,
    parallelExecution: false,
    coverageReports: true,
    continueOnFailure: false,
    showWarnings: true
  })

  const handleConfigure = () => {
    setShowConfigModal(true)
  }

  const handleSaveConfig = () => {
    setShowConfigModal(false)
    success('Configuration Saved', 'Test configuration updated successfully!')
  }

  const handleClearOutput = () => {
    clearTestOutput()
    success('Output Cleared', 'Test output has been cleared!')
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
            Test Suite
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive testing and validation framework
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          <Button 
            onClick={handleRunTests}
            disabled={isRunning || runningTests.length > 0}
            className="flex-shrink-0"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">
              {isRunning ? 'Running All Tests...' : 'Run All Tests'}
            </span>
            <span className="sm:hidden">
              {isRunning ? 'Running...' : 'Run All'}
            </span>
          </Button>
          
          <div className="relative">
            <Button 
              variant="outline"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex-shrink-0"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export Results</span>
              <span className="sm:hidden">Export</span>
            </Button>
            
            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-32 sm:w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => { handleDownloadTestResults('csv'); setShowDownloadMenu(false) }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={() => { handleDownloadTestResults('json'); setShowDownloadMenu(false) }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download JSON
                  </button>
                  <button
                    onClick={() => { handleDownloadTestResults('pdf'); setShowDownloadMenu(false) }}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            onClick={loadTestSuites}
            disabled={isRunning}
            className="flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleConfigure}
            className="flex-shrink-0"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

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

      {/* Test Suites Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
      >
        {testSuites.map((suite: any, index: number) => (
          <motion.div
            key={suite.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
          >
            <Card hover className="h-full">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle size="sm" className="text-base sm:text-lg">{suite.name}</CardTitle>
                  <StatusBadge status={suite.status} animate />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {suite.description}
                </p>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        Progress
                      </span>
                      <span className="font-medium">
                        {suite.passed + suite.failed} / {suite.tests}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${((suite.passed + suite.failed) / suite.tests) * 100}%` 
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-primary-600 h-2 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Test Results */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-success-600 dark:text-success-400">
                        {suite.passed}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Passed
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-danger-600 dark:text-danger-400">
                        {suite.failed}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Failed
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-warning-600 dark:text-warning-400">
                        {(suite as any).warnings || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Warnings
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex-1"
                      disabled={isRunning || runningTests.includes(suite.id)}
                      onClick={() => handleRunSingleSuite(suite.id)}
                    >
                      {runningTests.includes(suite.id) ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 mr-1" />
                      )}
                      {runningTests.includes(suite.id) ? 'Running...' : 'Run Suite'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDownloadTestResults('csv')}
                      className="sm:w-auto w-full"
                    >
                      <Download className="w-3 h-3 mr-1 sm:mr-0" />
                      <span className="sm:hidden">Download Results</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Live Test Output */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Live Test Output</CardTitle>
              {testOutput && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleClearOutput}
                  className="text-xs"
                >
                  Clear Output
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-sm min-h-[300px] max-h-[400px] overflow-y-auto">
              {testOutput ? (
                <pre className="text-green-400 whitespace-pre-wrap">
                  {testOutput}
                </pre>
              ) : (
                <div className="text-gray-500">
                  Test output will appear here when tests are running...
                </div>
              )}
              {isRunning && !testOutput && (
                <div className="text-yellow-400 animate-pulse">
                  → Running compliance detection tests...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-lg border dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Test Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Test Timeout (seconds)</label>
                <input
                  type="number"
                  value={testConfig.timeout}
                  onChange={(e) => setTestConfig({...testConfig, timeout: parseInt(e.target.value)})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="10"
                  max="300"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="verboseOutput"
                  checked={testConfig.verboseOutput}
                  onChange={(e) => setTestConfig({...testConfig, verboseOutput: e.target.checked})}
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="verboseOutput" className="text-sm text-gray-700 dark:text-gray-300">Verbose output</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="parallelExecution"
                  checked={testConfig.parallelExecution}
                  onChange={(e) => setTestConfig({...testConfig, parallelExecution: e.target.checked})}
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="parallelExecution" className="text-sm text-gray-700 dark:text-gray-300">Parallel execution</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="coverageReports"
                  checked={testConfig.coverageReports}
                  onChange={(e) => setTestConfig({...testConfig, coverageReports: e.target.checked})}
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="coverageReports" className="text-sm text-gray-700 dark:text-gray-300">Generate coverage reports</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="continueOnFailure"
                  checked={testConfig.continueOnFailure}
                  onChange={(e) => setTestConfig({...testConfig, continueOnFailure: e.target.checked})}
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="continueOnFailure" className="text-sm text-gray-700 dark:text-gray-300">Continue on failure</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showWarnings"
                  checked={testConfig.showWarnings}
                  onChange={(e) => setTestConfig({...testConfig, showWarnings: e.target.checked})}
                  className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="showWarnings" className="text-sm text-gray-700 dark:text-gray-300">Show warnings</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowConfigModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfig}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestSuite