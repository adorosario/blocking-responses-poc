import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Info, 
  AlertTriangle, 
  Shield, 
  BarChart3,
  RefreshCw,
  MessageSquare,
  User,
  Bot,
  Copy,
  StopCircle,
  Hash,
  Settings,
  ChevronDown,
  Zap,
  Target,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, RiskBadge } from '@/components/ui/Badge'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useConnection } from '@/utils/useConnection'
import { useNotifications } from '@/components/ui/Notifications'
import { useDashboardStore } from '@/stores/dashboard'
import { apiClient } from '@/utils/api'

// User-friendly pattern name mappings
const PATTERN_NAMES: { [key: string]: string } = {
  'email': '📧 Email Address',
  'phone': '📱 Phone Number', 
  'ssn': '🆔 Social Security Number',
  'credit_card': '💳 Credit Card',
  'password': '🔑 Password',
  'api_key': '🗝️ API Key',
  'phi_context': '🏥 Health Information',
  'medical_record': '📋 Medical Record',
  'pci_context': '💰 Payment Information',
  'pii_context': '👤 Personal Information',
  'person_name': '👤 Person Name',
  'address': '🏠 Address',
  'bank_account': '🏦 Bank Account',
  'crypto_address': '₿ Crypto Address',
  'government_id': '🆔 Government ID',
  'us_passport': '📘 US Passport',
  'us_driver_license': '📄 Driver License',
  'iban': '🏦 IBAN Code',
  'routing_number': '🏦 Routing Number'
}

const getPatternDisplayName = (patternCode: string): string => {
  return PATTERN_NAMES[patternCode] || `⚠️ ${patternCode.replace('_', ' ').toUpperCase()}`
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
  riskScore?: number
  entities?: string[]
  patterns?: string[]
  inputAnalysis?: WindowAnalysis[]
  responseWindows?: WindowAnalysis[]
  blocked?: boolean
  blockReason?: string
}


interface WindowAnalysis {
  window_text: string
  window_start: number
  window_end: number
  window_size: number
  analysis_position: number
  pattern_score: number
  presidio_score: number
  total_score: number
  triggered_rules: string[]
  presidio_entities: any[]
  timestamp: string
  analysis_type: 'input' | 'response'
  window_number?: number
}

interface AnalysisConfig {
  analysis_window_size: number
  analysis_overlap: number
  analysis_frequency: number
  risk_threshold: number
  delay_tokens: number
  delay_ms: number
}

const StreamMonitor: React.FC = () => {
  // Global metrics from dashboard store
  const { updateMetrics } = useDashboardStore()

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('Please write me an essay in 500 words about diabetes. What should I do if I am at risk for diabetes.')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  

  // Analysis state
  const [riskScores, setRiskScores] = useState<number[]>([])
  const [inputWindowAnalyses, setInputWindowAnalyses] = useState<WindowAnalysis[]>([])
  const [responseWindows, setResponseWindows] = useState<WindowAnalysis[]>([])
  const [currentRiskScore, setCurrentRiskScore] = useState<number>(0)

  // Config state
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>({
    analysis_window_size: 200,
    analysis_overlap: 50,
    analysis_frequency: 200,
    risk_threshold: 0.7,
    delay_tokens: 24,
    delay_ms: 250
  })

  // UI State
  const [showComplianceInfo, setShowComplianceInfo] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showDecisionTimelineModal, setShowDecisionTimelineModal] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'analyzing' | 'streaming' | 'complete'>('idle')
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)

  // Temporary config state for editing
  const [tempConfig, setTempConfig] = useState({
    analysis_window_size: '200',
    analysis_frequency: '200',
    risk_threshold: '0.7'
  })
  const [configErrors, setConfigErrors] = useState({
    analysis_window_size: '',
    analysis_frequency: '',
    risk_threshold: ''
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  const evtSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isConnected = useConnection()
  const { error, warning } = useNotifications()

  // Auto-scroll for messages
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, currentResponse])

  // Fetch config on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('http://localhost:8000/compliance/analysis-config')
        if (response.ok) {
          const config = await response.json()
          setAnalysisConfig(config.current_config)
        }
      } catch (err) {
        console.error('Failed to fetch analysis config:', err)
      }
    }
    fetchConfig()
  }, [])

  // Fetch global metrics periodically for Live Statistics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await apiClient.getMetrics()
        if (response.success && response.data) {
          updateMetrics(response.data)
        }
      } catch (err) {
        console.error('Failed to fetch metrics:', err)
      }
    }

    // Initial fetch
    fetchMetrics()

    // Set up periodic fetching every 3 seconds for live stats
    const interval = setInterval(fetchMetrics, 3000)

    return () => clearInterval(interval)
  }, [updateMetrics])

  useEffect(() => {
    return () => {
      if (evtSourceRef.current) {
        evtSourceRef.current.close()
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const generateMessageId = () => crypto.randomUUID()

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) {
      warning('Invalid Input', 'Please enter a message to send')
      return
    }

    const messageId = generateMessageId()
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    }

    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setCurrentMessageId(messageId)
    setCurrentMessage('')
    setIsStreaming(true)
    setRiskScores([])
    setInputWindowAnalyses([])
    setResponseWindows([])
    setCurrentRiskScore(0)
    setProcessingStatus('analyzing')
    
    let accumulatedContent = ''

    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()

      const apiKey = localStorage.getItem('openai_api_key')

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          delay_tokens: analysisConfig.delay_tokens,
          delay_ms: analysisConfig.delay_ms,
          risk_threshold: analysisConfig.risk_threshold,
          analysis_window_size: analysisConfig.analysis_window_size,
          analysis_frequency: analysisConfig.analysis_frequency,
          api_key: apiKey,
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataContent = line.slice(6)
            
            if (dataContent === '[DONE]') {
              setIsStreaming(false)
              setProcessingStatus('complete')
              continue
            }

            try {
              const data = JSON.parse(dataContent)
              console.log('SSE Event received:', data.type, data)
              
              if (data.type === 'chunk') {
                if (processingStatus !== 'streaming') {
                  setProcessingStatus('streaming')
                }
                
                accumulatedContent += data.content
                
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId ? { ...msg, content: accumulatedContent } : msg
                ))
              }

              // Handle input window analysis events
              if (data.type === 'input_window') {
                const timestamp = new Date().toLocaleTimeString() + '.' + Date.now().toString().slice(-3)
                const analysisData = JSON.parse(data.content)

                const windowAnalysis: WindowAnalysis = {
                  ...analysisData,
                  timestamp
                }
                setInputWindowAnalyses(prev => [...prev, windowAnalysis])
                setRiskScores(prev => [...prev, analysisData.total_score])
                setCurrentRiskScore(analysisData.total_score)
              }

              // Handle response window analysis events
              if (data.type === 'response_window') {
                const timestamp = new Date().toLocaleTimeString() + '.' + Date.now().toString().slice(-3)
                const analysisData = JSON.parse(data.content)

                const windowAnalysis: WindowAnalysis = {
                  ...analysisData,
                  timestamp
                }
                setResponseWindows(prev => [...prev, windowAnalysis])
                setRiskScores(prev => [...prev, analysisData.total_score])
                setCurrentRiskScore(Math.max(currentRiskScore, analysisData.total_score))
              }
              
              
              if (data.type === 'blocked') {
                console.log('Blocked event data:', data)
                const blockReason = data.content || data.reason || 'Content violated compliance policies'

                // Update the message to show it was blocked
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId ? {
                          ...msg,
                    content: '⚠️ This response was blocked due to compliance violations.',
                          streaming: false,
                          blocked: true,
                          blockReason: blockReason,
                    riskScore: data.risk_score
                  } : msg
                ))
                
                error('Stream Blocked', blockReason)
                setIsStreaming(false)
                setCurrentMessageId(null)
                break
              }
              
              if (data.type === 'completed') {
                // Finalize the message - just stop streaming
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId ? {
                          ...msg,
                          streaming: false,
                          inputAnalysis: inputWindowAnalyses,
                          responseWindows: responseWindows,
                    riskScore: Math.max(...riskScores, 0)
                  } : msg
                ))
                
                setIsStreaming(false)
                setCurrentMessageId(null)
                setProcessingStatus('complete')
                break
              }
              
            } catch (e) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (err: any) {
      // Don't show error if request was aborted (user clicked stop)
      if (err.name !== 'AbortError') {
        error('Stream Error', `Failed to start stream: ${err}`)
      }

      setIsStreaming(false)
      setCurrentMessageId(null)

      // Update message to show appropriate status
      if (messageId) {
        const content = err.name === 'AbortError' 
          ? (accumulatedContent || 'Response was stopped.')
          : '❌ Failed to generate response due to an error.'
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {
                  ...msg,
                  content,
            streaming: false
          } : msg
        ))
                }
      }
    }

  const handleStopStream = () => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (evtSourceRef.current) {
      evtSourceRef.current.close()
      evtSourceRef.current = null
    }

    setIsStreaming(false)
    setCurrentMessageId(null)

    if (currentMessageId) {
      setMessages(prev => prev.map(msg => 
        msg.id === currentMessageId ? {
                ...msg,
          content: msg.content || 'Response was stopped.',
          streaming: false
        } : msg
      ))
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const clearChat = () => {
    setMessages([])
    setCurrentResponse('')
    setRiskScores([])
    setInputWindowAnalyses([])
    setResponseWindows([])
    setCurrentRiskScore(0)
    setProcessingStatus('idle')
  }

  // Initialize temp config when component mounts or when actual config changes
  useEffect(() => {
    setTempConfig({
      analysis_window_size: analysisConfig.analysis_window_size.toString(),
      analysis_frequency: analysisConfig.analysis_frequency.toString(),
      risk_threshold: analysisConfig.risk_threshold.toString()
    })
    setHasUnsavedChanges(false)
  }, [analysisConfig])

  // Validate configuration values
  const validateConfig = () => {
    const errors = {
      analysis_window_size: '',
      analysis_frequency: '',
      risk_threshold: ''
    }

    const windowSize = parseInt(tempConfig.analysis_window_size)
    if (isNaN(windowSize) || windowSize < 50 || windowSize > 500) {
      errors.analysis_window_size = 'Must be a number between 50 and 500'
    }

    const frequency = parseInt(tempConfig.analysis_frequency)
    if (isNaN(frequency) || frequency < 5 || frequency > 500) {
      errors.analysis_frequency = 'Must be a number between 5 and 500'
    }

    const threshold = parseFloat(tempConfig.risk_threshold)
    if (isNaN(threshold) || threshold < 0.0 || threshold > 1.0) {
      errors.risk_threshold = 'Must be a number between 0.0 and 1.0'
    }

    setConfigErrors(errors)
    return Object.values(errors).every(error => error === '')
  }

  // Save configuration
  const saveConfig = () => {
    if (validateConfig()) {
      const newConfig = {
        ...analysisConfig,
        analysis_window_size: parseInt(tempConfig.analysis_window_size),
        analysis_frequency: parseInt(tempConfig.analysis_frequency),
        risk_threshold: parseFloat(tempConfig.risk_threshold)
      }
      setAnalysisConfig(newConfig)
      setHasUnsavedChanges(false)
      warning('Settings Updated', `Window: ${newConfig.analysis_window_size} • Freq: ${newConfig.analysis_frequency}x`)
    }
  }

  // Reset to saved values
  const resetConfig = () => {
    setTempConfig({
      analysis_window_size: analysisConfig.analysis_window_size.toString(),
      analysis_frequency: analysisConfig.analysis_frequency.toString(),
      risk_threshold: analysisConfig.risk_threshold.toString()
    })
    setConfigErrors({
      analysis_window_size: '',
      analysis_frequency: '',
      risk_threshold: ''
    })
    setHasUnsavedChanges(false)
  }

  return (
    <div className={`h-full bg-gray-50 dark:bg-gray-900 overflow-hidden ${isStreaming ? 'select-none' : ''} flex flex-col lg:flex-row`}>
      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-gray-800 relative order-1 lg:order-1">
        {/* Header with Real-Time Risk Scoring - FIXED TOP */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 xs:px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center space-x-2 xs:space-x-3 min-w-0">
              <div className="w-7 h-7 xs:w-8 xs:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 xs:w-5 xs:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm xs:text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                  Chat
                </h1>
              </div>
            </div>

            {/* MAIN ACTION - Real-Time Risk Scoring */}
            <div className="flex items-center space-x-1 xs:space-x-2 sm:space-x-3 flex-shrink-0">
              {isStreaming && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="hidden sm:flex items-center space-x-2 xs:space-x-3 px-2 xs:px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center space-x-1 xs:space-x-2">
                    <Target className="w-4 h-4 xs:w-5 xs:h-5 text-blue-600 animate-pulse" />
                    <div>
                      <div className="text-xs xs:text-sm font-bold text-blue-900 dark:text-blue-100">
                        <span className="hidden xs:inline">Risk Score: </span>{currentRiskScore.toFixed(3)}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 hidden md:block">
                        {processingStatus === 'analyzing' ? 'Analyzing input...' : 
                         processingStatus === 'streaming' ? 'Monitoring response...' : 
                         'Processing...'}
                      </div>
                    </div>
                  </div>
                  <RiskBadge score={currentRiskScore} />
                </motion.div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.assign('/testing')}
                icon={<BarChart3 className="w-4 h-4" />}
                className="transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComplianceInfo(!showComplianceInfo)}
                icon={<Info className="w-4 h-4" />}
                className="hidden sm:flex"
              />
            </div>
          </div>
        </div>

        {/* Mobile Analysis Panel Toggle */}
        <div className="lg:hidden flex-shrink-0 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-3 xs:px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            icon={<Target className="w-4 h-4" />}
            className={`w-full justify-center ${showDebugPanel ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300' : ''}`}
          >
            Analysis
          </Button>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-3 xs:px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-800 dark:text-amber-200 text-sm">
                Connection to backend API is unavailable
              </span>
            </div>
          </div>
        )}

        {/* Messages Area - SCROLLABLE ONLY */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          ref={chatContainerRef}
          style={{
            scrollBehavior: 'smooth',
            minHeight: 0
          }}
        >
          <div className="px-3 xs:px-4 sm:px-6 py-4 xs:py-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center min-h-96">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Send a message
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="space-y-4 xs:space-y-6 pb-4">
                {messages.map((message, index) => {
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      onMouseEnter={() => setHoveredMessage(message.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                    <div className={`max-w-3xl w-full ${message.role === 'user' ? 'ml-6 xs:ml-8 sm:ml-12' : 'mr-6 xs:mr-8 sm:mr-12'}`}>
                      <div className={`
                        rounded-2xl p-3 xs:p-4 shadow-sm relative group
                        ${message.role === 'user' 
                          ? 'bg-blue-600 text-white ml-auto rounded-tr-md' 
                            : message.blocked
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-tl-md'
                          : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-tl-md'
                        }
                      `}>
                          {/* Message Header */}
                          <div className="flex items-center justify-between mb-1 xs:mb-2">
                            <div className="flex items-center space-x-2">
                            <div className={`
                              w-6 h-6 rounded-full flex items-center justify-center
                              ${message.role === 'user' 
                                ? 'bg-white bg-opacity-20 text-white' 
                                  : message.blocked
                                ? 'bg-red-500 text-white'
                                : 'bg-green-500 text-white'
                              }
                            `}>
                              {message.role === 'user' ? (
                                  <User className="w-4 h-4" />
                                ) : message.blocked ? (
                                  <AlertTriangle className="w-4 h-4" />
                                ) : (
                                  <Bot className="w-4 h-4" />
                                )}
                              </div>
                            <span className={`text-xs xs:text-sm font-medium ${
                              message.role === 'user' 
                                ? 'text-blue-100' 
                                    : message.blocked
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}>
                              {message.role === 'user' ? 'You' : message.blocked ? 'Blocked Response' : 'AI Assistant'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              {message.streaming && (
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-green-600 dark:text-green-400 hidden xs:inline">Streaming</span>
                                </div>
                              )}
                              {message.riskScore !== undefined && (
                                <RiskBadge score={message.riskScore} />
                              )}
                            {message.role === 'assistant' && !message.blocked && !message.streaming && (
                                  <Badge variant="success" size="sm">
                                    ✓ Safe
                                  </Badge>
                                )}

                              {/* Message Actions */}
                              <AnimatePresence>
                                {hoveredMessage === message.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center space-x-1"
                                  >
                                    <button
                                    onClick={() => copyMessage(message.content)}
                                      className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  {((message.role === 'user' && message.inputAnalysis && message.inputAnalysis.length > 0) ||
                                    (message.role === 'assistant' && message.responseWindows && message.responseWindows.length > 0)) && (
                                      <button
                                      onClick={() => setExpandedMessage(expandedMessage === message.id ? null : message.id)}
                                        className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
                                      >
                                        <Hash className="w-3 h-3" />
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Message Content */}
                        <div className={`
                          text-sm xs:text-base leading-relaxed
                          ${message.role === 'user' 
                            ? 'text-white' 
                              : message.blocked
                            ? 'text-red-800 dark:text-red-200'
                            : 'text-gray-900 dark:text-white'
                          }
                        `}>
                            {message.content ? (
                            message.role === 'assistant' ? (
                              <MarkdownRenderer 
                                content={message.content}
                                className="text-inherit"
                              />
                              ) : (
                                <span>{message.content}</span>
                              )
                            ) : message.streaming ? (
                            <span className="text-gray-500 dark:text-gray-400 italic">Generating response...</span>
                            ) : (
                            <span className="text-gray-500 dark:text-gray-400 italic">No content</span>
                            )}
                            {message.streaming && (
                              <motion.span
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="inline-block w-0.5 h-5 bg-blue-500 ml-1 rounded-sm"
                              />
                            )}
                          </div>

                          {/* Window Analysis Details */}
                          <AnimatePresence>
                          {expandedMessage === message.id && (
                            (message.role === 'user' && message.inputAnalysis) || 
                            (message.role === 'assistant' && message.responseWindows)
                          ) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600"
                                >
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Window Analysis: {(message.role === 'user' ? message.inputAnalysis : message.responseWindows)?.length || 0} windows analyzed
                                  </div>
                                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {(message.role === 'user' ? message.inputAnalysis : message.responseWindows)?.map((analysis, idx) => (
                                      <div
                                        key={idx}
                                        className={`
                                      p-2 rounded text-xs border
                                      ${analysis.total_score >= analysisConfig.risk_threshold
                                        ? 'bg-red-100 border-red-300 text-red-800'
                                          : analysis.total_score >= 0.3
                                        ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                                        : 'bg-green-100 border-green-300 text-green-800'
                                      }
                                    `}
                                  >
                                    <div className="font-bold">Window {idx + 1}</div>
                                    <div>Risk: {analysis.total_score.toFixed(3)}</div>
                                    <div>Tokens: {analysis.window_start}-{analysis.window_end}</div>
                                        <div className="mt-1 text-xs opacity-75">
                                          <details className="cursor-pointer">
                                            <summary className="line-clamp-2">
                                              "{analysis.window_text.substring(0, 80)}..."
                                            </summary>
                                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                              {analysis.window_text}
                                            </div>
                                          </details>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area - FIXED BOTTOM */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 relative z-10">
          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-4 py-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Analysis Configuration</h3>
                  <div className="flex items-center space-x-2">
                    {hasUnsavedChanges && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mr-1"></div>
                        Unsaved changes
                      </span>
                    )}
                    {/* <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(false)}
                      icon={<ChevronUp className="w-4 h-4" />}
                      title="Hide Settings"
                    >
                      Hide
                    </Button> */}
                  </div>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4 text-sm mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Window Size
                      </label>
                      <span className="text-xs text-gray-500 dark:text-gray-400">50-500 tokens</span>
                    </div>
                    <input
                      type="text"
                      value={tempConfig.analysis_window_size}
                      onChange={(e) => {
                        setTempConfig(prev => ({...prev, analysis_window_size: e.target.value}))
                        setHasUnsavedChanges(true)
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                        configErrors.analysis_window_size
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                      }`}
                      placeholder="150"
                    />
                    {configErrors.analysis_window_size && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {configErrors.analysis_window_size}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Size of each analysis window
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Frequency
                      </label>
                      <span className="text-xs text-gray-500 dark:text-gray-400">5-500 tokens</span>
                    </div>
                    <input
                      type="text"
                      value={tempConfig.analysis_frequency}
                      onChange={(e) => {
                        setTempConfig(prev => ({...prev, analysis_frequency: e.target.value}))
                        setHasUnsavedChanges(true)
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                        configErrors.analysis_frequency
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                      }`}
                      placeholder="25"
                    />
                    {configErrors.analysis_frequency && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {configErrors.analysis_frequency}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Analysis interval
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Risk Threshold
                      </label>
                      <span className="text-xs text-gray-500 dark:text-gray-400">0.0-1.0</span>
                    </div>
                    <input
                      type="text"
                      value={tempConfig.risk_threshold}
                      onChange={(e) => {
                        setTempConfig(prev => ({...prev, risk_threshold: e.target.value}))
                        setHasUnsavedChanges(true)
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                        configErrors.risk_threshold
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                      }`}
                      placeholder="0.7"
                    />
                    {configErrors.risk_threshold && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {configErrors.risk_threshold}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Blocking threshold
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between pt-3 border-t border-gray-200 dark:border-gray-600 gap-3 xs:gap-0">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveConfig}
                      disabled={!hasUnsavedChanges}
                      className={hasUnsavedChanges ? 'animate-pulse' : ''}
                    >
                      Save Changes
                    </Button>
                    {hasUnsavedChanges && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={resetConfig}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearChat}
                    disabled={isStreaming}
                    className="w-full xs:w-auto"
                  >
                    Clear Chat
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Box - Modern Integrated Design */}
          <div className="p-4 xs:p-4">
            <div className="relative">
              {/* Main Input Container */}
              <div className="relative bg-white dark:bg-gray-700 rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:ring-4 focus-within:ring-blue-500/10">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Message Compliance AI..."
                  className={`w-full p-4 pr-20 bg-transparent text-gray-900 dark:text-white resize-none max-h-32 rounded-2xl border-0 outline-none placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 text-base sm:text-sm ${
                    isStreaming 
                      ? 'cursor-not-allowed' 
                      : ''
                  }`}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (currentMessage.trim() && !isStreaming) {
                        handleSendMessage()
                      }
                    }
                  }}
                  disabled={isStreaming}
                  style={{
                    height: 'auto',
                    minHeight: '56px'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                  }}
                />
                
                {/* (counter moved below input) */}

                {/* Integrated Action Buttons - Bottom Right */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {/* Inline Settings icon-only button */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    title={showSettings ? 'Hide Settings' : 'Show Settings'}
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-all"
                  >
                    {showSettings ? <ChevronDown className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                  </button>
                  {isStreaming ? (
                    <button
                      onClick={handleStopStream}
                      className="group flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-500/30"
                      title="Stop streaming"
                    >
                      <StopCircle className="w-5 h-5 text-white" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSendMessage}
                      disabled={!currentMessage.trim() || !isConnected}
                      className={`group flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-4 ${
                        currentMessage.trim() && isConnected
                          ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:scale-105 focus:ring-blue-500/30 cursor-pointer'
                          : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        !currentMessage.trim()
                          ? "Enter a message to send"
                          : !isConnected
                          ? "Connection unavailable"
                          : "Send message (Enter)"
                      }
                    >
                      <Send
                        className={`w-5 h-5 transition-all duration-200 ${
                          currentMessage.trim() && isConnected
                            ? 'text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Input Border States */}
                <div className={`absolute inset-0 rounded-2xl border-2 pointer-events-none transition-all duration-200 ${
                    isStreaming
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-900/20' 
                      : currentMessage.trim()
                    ? 'border-blue-300 dark:border-blue-600'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}></div>
              </div>
            </div>

            {/* Quick Status */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-3">
                {isStreaming ? (
                  <div className="flex items-center space-x-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="text-blue-600">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>Ready</span>
                  </div>
                )}
                <span className="font-mono text-xs text-gray-500">
                  {analysisConfig.analysis_window_size} • {analysisConfig.analysis_frequency}x
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono">
                {currentMessage.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel - Desktop Sidebar / Mobile Overlay */}
      <div className={`
        ${showDebugPanel ? 'block' : 'hidden lg:block'}
        lg:w-80 lg:flex-shrink-0
        fixed lg:relative inset-0 lg:inset-auto 
        z-40 lg:z-auto
        bg-gray-50 dark:bg-gray-900 
        border-l border-gray-200 dark:border-gray-700 
        flex flex-col h-full max-h-screen overflow-y-auto
        lg:order-2 order-2
        ${showDebugPanel ? 'lg:shadow-none shadow-2xl' : ''}
      `}>
        <div className="flex-shrink-0 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebugPanel(false)}
              className="lg:hidden p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3 xs:p-4 space-y-3 xs:space-y-4">
          {/* Real-Time Analysis Visualizer */}
          <div>
            {isStreaming && (
              <div className="mb-3 flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-purple-600 font-medium">Analyzing</span>
              </div>
            )}
            
            {/* Current Analysis Window */}
            {responseWindows.length > 0 && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-mono">
                  Window {responseWindows[responseWindows.length - 1]?.window_number || responseWindows.length}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border">
                  <details className="cursor-pointer">
                    <summary className="font-mono text-xs leading-relaxed line-clamp-3">
                      "{responseWindows[responseWindows.length - 1]?.window_text.substring(0, 150)}..."
                    </summary>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {responseWindows[responseWindows.length - 1]?.window_text}
                    </div>
                  </details>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{responseWindows[responseWindows.length - 1]?.pattern_score.toFixed(2)}</div>
                    <div className="text-blue-700 dark:text-blue-300">Pattern Score</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-orange-600">{responseWindows[responseWindows.length - 1]?.presidio_score.toFixed(2)}</div>
                    <div className="text-orange-700 dark:text-orange-300">ML Score</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-purple-600">{responseWindows[responseWindows.length - 1]?.total_score.toFixed(2)}</div>
                    <div className="text-purple-700 dark:text-purple-300">Total Risk</div>
                  </div>
                </div>
                {responseWindows[responseWindows.length - 1]?.triggered_rules.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">Found:</div>
                    <div className="flex flex-wrap gap-1">
                      {responseWindows[responseWindows.length - 1]?.triggered_rules.map((rule, idx) => (
                        <Badge key={idx} variant="warning" size="sm">{getPatternDisplayName(rule)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Status Indicator */}
            {processingStatus !== 'idle' && (
              <div className="mb-4">
                {processingStatus === 'analyzing' && (
                  <div className="flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Scanning input...</span>
                  </div>
                )}
                {processingStatus === 'streaming' && (
                  <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    <Zap className="w-3 h-3" />
                    <span>Streaming response...</span>
                  </div>
                )}
                {processingStatus === 'complete' && (
                  <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    <Shield className="w-3 h-3" />
                    <span>Complete • {responseWindows.length} windows</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Analysis History & Windows */}
          <div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(inputWindowAnalyses.length > 0 || responseWindows.length > 0) ? (
                [...inputWindowAnalyses, ...responseWindows]
                  .sort((a, b) => {
                    // Sort by analysis position, with most recent at top
                    if (a.analysis_type === b.analysis_type) {
                      return (b.window_start || 0) - (a.window_start || 0)
                    }
                    // Input windows first, then response windows  
                    return a.analysis_type === 'input' ? -1 : 1
                  })
                  .slice(0, 8)
                  .map((analysis, index) => (
                  <motion.div
                    key={`${analysis.analysis_type}-${analysis.window_start}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border-l-4 ${
                      analysis.total_score >= analysisConfig.risk_threshold
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : analysis.total_score >= 0.3
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={analysis.analysis_type === 'input' ? 'secondary' : 'info'} 
                          size="sm"
                        >
                          {analysis.analysis_type === 'input' ? '📥' : '📤'} #{index + 1}
                        </Badge>
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          Tokens {analysis.window_start}-{analysis.window_end}
                        </span>
                      </div>
                      <RiskBadge score={analysis.total_score} />
                    </div>
                    
                    <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded mb-2">
                      <details className="cursor-pointer">
                        <summary className="font-mono line-clamp-2">
                          "{analysis.window_text.substring(0, 100)}..."
                        </summary>
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-600 rounded font-mono text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {analysis.window_text}
                        </div>
                      </details>
                    </div>
                    
                    {analysis.triggered_rules.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-red-600 dark:text-red-400">Compliance Issues:</div>
                        <details className="cursor-pointer">
                          <summary className="flex flex-wrap gap-1">
                            {analysis.triggered_rules.slice(0, 2).map((rule, idx) => (
                              <Badge key={idx} variant="warning" size="sm">{getPatternDisplayName(rule)}</Badge>
                            ))}
                            {analysis.triggered_rules.length > 2 && (
                              <Badge variant="outline" size="sm">+{analysis.triggered_rules.length - 2}</Badge>
                            )}
                            <span className="text-xs text-gray-500 ml-2">Click for details</span>
                          </summary>
                          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                            <div className="text-xs font-semibold mb-2">Detection Details:</div>
                            {analysis.triggered_rules.map((rule, idx) => (
                              <div key={idx} className="text-xs font-mono mb-1 p-2 bg-white dark:bg-gray-800 rounded border">
                                {rule}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : null}
            </div>
          </div>

          {/* Session Summary */}
          <div>
            
            {/* Key Metrics */}
            <div className="space-y-3">
              {/* Safety Status */}
              <div className={`p-3 rounded-lg border ${
                (inputWindowAnalyses.length > 0 || responseWindows.length > 0) 
                  ? (riskScores.length > 0 && Math.max(...riskScores) >= analysisConfig.risk_threshold
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20')
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className={`w-4 h-4 ${
                      (inputWindowAnalyses.length > 0 || responseWindows.length > 0)
                        ? (riskScores.length > 0 && Math.max(...riskScores) >= analysisConfig.risk_threshold
                            ? 'text-red-600'
                            : 'text-green-600')
                        : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-semibold ${
                      (inputWindowAnalyses.length > 0 || responseWindows.length > 0)
                        ? (riskScores.length > 0 && Math.max(...riskScores) >= analysisConfig.risk_threshold
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-green-700 dark:text-green-300')
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {(inputWindowAnalyses.length === 0 && responseWindows.length === 0) 
                        ? 'Ready'
                        : (riskScores.length > 0 && Math.max(...riskScores) >= analysisConfig.risk_threshold
                            ? 'Risk Detected'
                            : 'Safe')}
                    </span>
                  </div>
                  {riskScores.length > 0 && (
                    <RiskBadge score={Math.max(...riskScores)} />
                  )}
                </div>
                
                {riskScores.length > 0 && (
                  <div className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">
                    {Math.max(...riskScores).toFixed(2)}
                  </div>
                )}
              </div>
              
              {/* Configuration */}
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono text-center text-gray-600 dark:text-gray-400">
                {analysisConfig.analysis_window_size} • {analysisConfig.analysis_frequency}x
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel Mobile Overlay Background */}
      {showDebugPanel && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setShowDebugPanel(false)}
        />
      )}

      {/* Compliance Info Modal */}
      <AnimatePresence>
        {showComplianceInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowComplianceInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-3 xs:mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 xs:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                    <Shield className="w-6 h-6 text-blue-600" />
                    <span>How Sliding Window Analysis Works</span>
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setShowComplianceInfo(false)}>
                    Close
                  </Button>
                </div>

                <div className="space-y-3 xs:space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Input Analysis</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Your input is analyzed using {analysisConfig.analysis_window_size}-token sliding windows, 
                      with analysis performed every {analysisConfig.analysis_frequency} tokens. This provides {" "} 
                      {analysisConfig.analysis_frequency}x efficiency compared to token-by-token analysis.
                    </p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">Response Streaming</h4>
                    <p className="text-sm text-green-800 dark:text-green-300">
                      Once your input passes all compliance checks, the AI response streams in real-time. 
                      Input analysis gates the entire response - no need to analyze each output token.
                    </p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">Risk Assessment</h4>
                    <p className="text-sm text-orange-800 dark:text-orange-300">
                      Content with risk scores above {analysisConfig.risk_threshold} is automatically blocked. 
                      The system uses pattern matching and Microsoft Presidio for PII/PHI/PCI detection.
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">Efficiency Benefits</h4>
                    <p className="text-sm text-purple-800 dark:text-purple-300">
                      This approach is {analysisConfig.analysis_frequency}x more efficient than analyzing every token, 
                      reducing costs by ~{Math.round((1 - 1/analysisConfig.analysis_frequency) * 100)}% while 
                      maintaining comprehensive coverage through overlapping windows.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Analysis Windows Modal */}
        {showDecisionTimelineModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDecisionTimelineModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">All Analysis Windows</h3>
                  <Badge variant="secondary" size="sm">{inputWindowAnalyses.length + responseWindows.length}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowDecisionTimelineModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[calc(85vh-64px)] space-y-3">
                {(inputWindowAnalyses.length > 0 || responseWindows.length > 0) ? (
                  [...inputWindowAnalyses, ...responseWindows]
                    .sort((a, b) => {
                      // Sort by analysis position, with most recent at top
                      if (a.analysis_type === b.analysis_type) {
                        return (b.window_start || 0) - (a.window_start || 0)
                      }
                      // Input windows first, then response windows
                      return a.analysis_type === 'input' ? -1 : 1
                    })
                    .map((analysis, index) => (
                    <div
                      key={`${analysis.analysis_type}-${analysis.window_start}-${index}`}
                      className={`p-4 rounded-lg border-l-4 ${
                        analysis.total_score >= analysisConfig.risk_threshold
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : analysis.total_score >= 0.3
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Badge 
                            variant={analysis.analysis_type === 'input' ? 'secondary' : 'info'} 
                            size="sm"
                          >
                            {analysis.analysis_type === 'input' ? '📥' : '📤'} #{index + 1}
                          </Badge>
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            Tokens {analysis.window_start}-{analysis.window_end} ({analysis.window_size} tokens)
                          </span>
                        </div>
                        <RiskBadge score={analysis.total_score} />
                      </div>
                      
                      <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded border font-mono text-sm leading-relaxed">
                        "{analysis.window_text}"
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <div className="font-bold text-blue-600">{analysis.pattern_score.toFixed(3)}</div>
                          <div className="text-blue-700 dark:text-blue-300 text-xs">Pattern Score</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                          <div className="font-bold text-orange-600">{analysis.presidio_score.toFixed(3)}</div>
                          <div className="text-orange-700 dark:text-orange-300 text-xs">ML Score</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                          <div className="font-bold text-purple-600">{analysis.total_score.toFixed(3)}</div>
                          <div className="text-purple-700 dark:text-purple-300 text-xs">Total Risk</div>
                        </div>
                      </div>
                      
                      {analysis.triggered_rules.length > 0 && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Found:</div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.triggered_rules.map((rule, idx) => (
                              <Badge key={idx} variant="warning" size="sm">{getPatternDisplayName(rule)}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {analysis.presidio_entities && analysis.presidio_entities.length > 0 && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                          <div className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">ML Detected Entities:</div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.presidio_entities.map((entity, idx) => (
                              <Badge key={idx} variant="secondary" size="sm">{entity.entity_type} ({(entity.confidence * 100).toFixed(0)}%)</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-20">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h4 className="text-lg font-semibold mb-2">No Analysis Windows Yet</h4>
                    <p className="text-sm">Send a message to see real-time analysis windows appear here</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

export default StreamMonitor