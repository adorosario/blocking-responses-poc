import { Notification } from '@/types'

export class NotificationManager {
  private static instance: NotificationManager
  private listeners: Set<(notifications: Notification[]) => void> = new Set()

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  getNotifications(): Notification[] {
    try {
      const saved = localStorage.getItem('notifications')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  private saveNotifications(notifications: Notification[]): void {
    localStorage.setItem('notifications', JSON.stringify(notifications))
    this.notifyListeners(notifications)
  }

  private notifyListeners(notifications: Notification[]): void {
    this.listeners.forEach(listener => listener(notifications))
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    }

    const notifications = this.getNotifications()
    notifications.unshift(newNotification) // Add to beginning
    
    // Keep only last 50 notifications
    if (notifications.length > 50) {
      notifications.splice(50)
    }

    this.saveNotifications(notifications)
  }

  markAsRead(id: string): void {
    const notifications = this.getNotifications()
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    )
    this.saveNotifications(updated)
  }

  markAllAsRead(): void {
    const notifications = this.getNotifications()
    const updated = notifications.map(n => ({ ...n, read: true }))
    this.saveNotifications(updated)
  }

  getUnreadCount(): number {
    return this.getNotifications().filter(n => !n.read).length
  }

  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // System event handlers
  onHighBlockRate(blockRate: number): void {
    if (blockRate > 20) {
      this.addNotification({
        type: 'warning',
        title: 'High Block Rate Detected',
        message: `Current blocking rate is ${blockRate.toFixed(1)}%. This may indicate unusual traffic patterns.`
      })
    }
  }

  onTestCompleted(testName: string, success: boolean): void {
    this.addNotification({
      type: success ? 'success' : 'error',
      title: `Test ${success ? 'Passed' : 'Failed'}`,
      message: `Compliance test "${testName}" has ${success ? 'passed' : 'failed'}.`
    })
  }

  onComplianceViolation(violationType: string, details: string): void {
    this.addNotification({
      type: 'error',
      title: 'Compliance Violation Detected',
      message: `${violationType}: ${details}`
    })
  }

  onSystemHealthCheck(healthy: boolean, responseTime?: number): void {
    if (healthy && responseTime && responseTime < 100) {
      this.addNotification({
        type: 'success',
        title: 'System Health Check',
        message: `All services are running normally. Response time: ${responseTime}ms.`
      })
    } else if (!healthy) {
      this.addNotification({
        type: 'error',
        title: 'System Health Issue',
        message: 'One or more services are experiencing issues.'
      })
    }
  }
}

export const notificationManager = NotificationManager.getInstance()
