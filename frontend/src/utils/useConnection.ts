import { useEffect } from 'react'
import { useDashboardStore } from '@/stores/dashboard'
import { apiClient } from '@/utils/api'

export const useConnection = () => {
  const { isConnected, setIsConnected } = useDashboardStore()

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiClient.getHealth()
        setIsConnected(true)
      } catch (error) {
        console.error('Connection check failed:', error)
        setIsConnected(false)
      }
    }

    // Initial connection check
    checkConnection()

    // Set up periodic connection checks every 30 seconds
    const interval = setInterval(checkConnection, 30000)

    return () => clearInterval(interval)
  }, [setIsConnected])

  return isConnected
}
