import { clsx, type ClassValue } from 'clsx'
import { format, formatDistance, formatRelative } from 'date-fns'

// Utility function for conditional class names
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Date formatting utilities
export const formatters = {
  datetime: (date: string | Date) => new Date(date).toLocaleString(),
  date: (date: string | Date) => format(new Date(date), 'MMM d, yyyy'),
  time: (date: string | Date) => new Date(date).toLocaleTimeString(),
  relative: (date: string | Date) => formatDistance(new Date(date), new Date(), { addSuffix: true }),
  relativeShort: (date: string | Date) => formatRelative(new Date(date), new Date()),
}

// Number formatting utilities
export const formatNumber = (num: number, options: Intl.NumberFormatOptions = {}) => {
  return new Intl.NumberFormat('en-US', options).format(num)
}

export const formatPercent = (num: number, decimals: number = 1) => {
  return formatNumber(num, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export const formatDuration = (milliseconds: number) => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  } else {
    return `${Math.floor(milliseconds / 60000)}m ${Math.floor((milliseconds % 60000) / 1000)}s`
  }
}

// Risk score utilities
export const getRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score < 0.3) return 'low'
  if (score < 0.7) return 'medium'
  if (score < 1.0) return 'high'
  return 'critical'
}

export const getRiskColor = (score: number) => {
  const level = getRiskLevel(score)
  const colors = {
    low: 'text-success-600 bg-success-50 dark:bg-success-900/20',
    medium: 'text-warning-600 bg-warning-50 dark:bg-warning-900/20',
    high: 'text-danger-600 bg-danger-50 dark:bg-danger-900/20',
    critical: 'text-red-800 bg-red-100 dark:bg-red-900/30',
  }
  return colors[level]
}

export const getComplianceColor = (type: string) => {
  const colors: Record<string, string> = {
    HIPAA: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
    PCI_DSS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    GDPR: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
    CCPA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    PII: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    PHI: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
  }
  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
}

// Text utilities
export const truncateText = (text: string, maxLength: number = 100) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>')
}

// Validation utilities
export const isValidEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export const isValidUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue || null
    } catch {
      return defaultValue || null
    }
  },
  
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to remove from localStorage:', error)
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
    }
  },
}

// Theme utilities
export const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const actualTheme = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', actualTheme === 'dark')
  storage.set('theme', theme)
}

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Copy to clipboard utility
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

// Generate unique IDs
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9)
}

export const generateTraceId = () => {
  return `trace_${Date.now()}_${generateId()}`
}