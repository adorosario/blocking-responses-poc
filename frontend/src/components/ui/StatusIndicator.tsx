import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Activity,
  Loader,
  Radio,
  Wifi,
  WifiOff
} from 'lucide-react'

interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'loading' | 'active' | 'inactive' | 'connected' | 'disconnected'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  description?: string
  animated?: boolean
  pulse?: boolean
  glow?: boolean
  minimal?: boolean
  className?: string
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  label,
  description,
  animated = true,
  pulse = false,
  glow = false,
  minimal = false,
  className
}) => {
  const statusConfig = {
    success: {
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-500',
      bgSoft: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      glow: 'shadow-green-500/25'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500',
      bgSoft: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      glow: 'shadow-yellow-500/25'
    },
    error: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-500',
      bgSoft: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      glow: 'shadow-red-500/25'
    },
    info: {
      icon: Activity,
      color: 'text-blue-500',
      bg: 'bg-blue-500',
      bgSoft: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      glow: 'shadow-blue-500/25'
    },
    loading: {
      icon: Loader,
      color: 'text-gray-500',
      bg: 'bg-gray-500',
      bgSoft: 'bg-gray-50 dark:bg-gray-800/50',
      border: 'border-gray-200 dark:border-gray-700',
      glow: 'shadow-gray-500/25'
    },
    active: {
      icon: Radio,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500',
      bgSoft: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      glow: 'shadow-emerald-500/25'
    },
    inactive: {
      icon: Clock,
      color: 'text-gray-400',
      bg: 'bg-gray-400',
      bgSoft: 'bg-gray-50 dark:bg-gray-800/30',
      border: 'border-gray-200 dark:border-gray-700',
      glow: 'shadow-gray-400/25'
    },
    connected: {
      icon: Wifi,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500',
      bgSoft: 'bg-cyan-50 dark:bg-cyan-900/20',
      border: 'border-cyan-200 dark:border-cyan-800',
      glow: 'shadow-cyan-500/25'
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-500',
      bg: 'bg-red-500',
      bgSoft: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      glow: 'shadow-red-500/25'
    }
  }

  const sizes = {
    sm: {
      dot: 'w-2 h-2',
      icon: 'w-3 h-3',
      container: 'text-xs',
      padding: 'p-2'
    },
    md: {
      dot: 'w-3 h-3',
      icon: 'w-4 h-4',
      container: 'text-sm',
      padding: 'p-3'
    },
    lg: {
      dot: 'w-4 h-4',
      icon: 'w-5 h-5',
      container: 'text-base',
      padding: 'p-4'
    },
    xl: {
      dot: 'w-6 h-6',
      icon: 'w-6 h-6',
      container: 'text-lg',
      padding: 'p-6'
    }
  }

  const config = statusConfig[status]
  const sizeConfig = sizes[size]
  const Icon = config.icon

  // Animation variants
  const dotVariants = {
    initial: { scale: 0.8, opacity: 0.6 },
    animate: { 
      scale: pulse ? [1, 1.2, 1] : 1, 
      opacity: 1,
    }
  }

  const iconVariants = {
    initial: { rotate: 0 },
    animate: { 
      rotate: status === 'loading' ? 360 : 0,
    }
  }

  if (minimal) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <motion.div
          initial="initial"
          animate="animate"
          variants={dotVariants}
          transition={{ 
            duration: pulse ? 2 : 0.3,
            repeat: pulse ? Infinity : 0,
            ease: "easeInOut"
          }}
          className={cn(
            sizeConfig.dot,
            config.bg,
            'rounded-full',
            glow && `shadow-lg ${config.glow}`
          )}
        />
        {label && (
          <span className={cn(sizeConfig.container, "font-medium text-gray-900 dark:text-white")}>
            {label}
          </span>
        )}
      </div>
    )
  }

  const ContainerComponent = animated ? motion.div : 'div'
  
  const containerMotionProps = animated ? {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 }
  } : {}

  return (
    <ContainerComponent
      className={cn(
        "flex items-center space-x-3 rounded-xl border transition-all duration-300",
        config.bgSoft,
        config.border,
        sizeConfig.padding,
        glow && `shadow-lg ${config.glow}`,
        className
      )}
      {...(animated ? containerMotionProps : {})}
    >
      {/* Icon */}
      <motion.div
        initial={animated ? "initial" : undefined}
        animate={animated ? "animate" : undefined}
        variants={animated ? iconVariants : undefined}
        transition={animated ? {
          duration: status === 'loading' ? 1 : 0.3,
          repeat: status === 'loading' ? Infinity : 0,
          ease: status === 'loading' ? "linear" : "easeInOut"
        } : undefined}
        className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-full",
          config.bg,
          sizeConfig.icon === 'w-3 h-3' ? 'p-1' :
          sizeConfig.icon === 'w-4 h-4' ? 'p-1.5' :
          sizeConfig.icon === 'w-5 h-5' ? 'p-2' : 'p-2.5'
        )}
      >
        <Icon className={cn(sizeConfig.icon, "text-white")} />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {label && (
          <motion.div
            initial={animated ? { opacity: 0, x: -5 } : undefined}
            animate={animated ? { opacity: 1, x: 0 } : undefined}
            transition={animated ? { delay: 0.1 } : undefined}
            className={cn(
              "font-semibold text-gray-900 dark:text-white",
              sizeConfig.container
            )}
          >
            {label}
          </motion.div>
        )}
        {description && (
          <motion.div
            initial={animated ? { opacity: 0, x: -5 } : undefined}
            animate={animated ? { opacity: 1, x: 0 } : undefined}
            transition={animated ? { delay: 0.2 } : undefined}
            className={cn(
              "text-gray-600 dark:text-gray-400 mt-0.5",
              size === 'sm' ? 'text-xs' :
              size === 'md' ? 'text-xs' :
              size === 'lg' ? 'text-sm' : 'text-base'
            )}
          >
            {description}
          </motion.div>
        )}
      </div>

      {/* Pulse effect */}
      {pulse && animated && (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-xl",
            config.bg,
            "opacity-20"
          )}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.2, 0.1, 0.2]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </ContainerComponent>
  )
}

// Preset combinations for common use cases
export const StreamingStatus: React.FC<{ isStreaming: boolean; className?: string }> = ({ 
  isStreaming, 
  className 
}) => (
  <StatusIndicator
    status={isStreaming ? "active" : "inactive"}
    label={isStreaming ? "Streaming" : "Idle"}
    description={isStreaming ? "Processing in real-time" : "Waiting for input"}
    pulse={isStreaming}
    glow={isStreaming}
    className={className}
  />
)

export const ConnectionStatus: React.FC<{ isConnected: boolean; className?: string }> = ({ 
  isConnected, 
  className 
}) => (
  <StatusIndicator
    status={isConnected ? "connected" : "disconnected"}
    label={isConnected ? "Connected" : "Disconnected"}
    description={isConnected ? "API connection active" : "Check network connection"}
    pulse={!isConnected}
    glow={isConnected}
    minimal
    className={className}
  />
)

export const RiskStatus: React.FC<{ riskLevel: number; className?: string }> = ({ 
  riskLevel, 
  className 
}) => {
  const getStatus = () => {
    if (riskLevel >= 0.8) return 'error'
    if (riskLevel >= 0.5) return 'warning'
    return 'success'
  }

  const getLabel = () => {
    if (riskLevel >= 0.8) return 'High Risk'
    if (riskLevel >= 0.5) return 'Medium Risk'
    return 'Low Risk'
  }

  return (
    <StatusIndicator
      status={getStatus()}
      label={getLabel()}
      description={`Risk score: ${riskLevel.toFixed(3)}`}
      pulse={riskLevel >= 0.8}
      glow={riskLevel >= 0.5}
      className={className}
    />
  )
}