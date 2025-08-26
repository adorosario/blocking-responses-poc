import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'gradient' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
  pulse?: boolean
  icon?: React.ReactNode
  removable?: boolean
  onRemove?: () => void
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  animate = false,
  pulse = false,
  icon,
  removable = false,
  onRemove,
  className,
  children,
  ...props
}) => {
  const baseStyles = cn(
    'inline-flex items-center font-semibold rounded-full transition-all duration-200 select-none',
    pulse && 'animate-pulse',
    removable && 'cursor-pointer hover:opacity-80'
  )
  
  const variants = {
    default: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/50 shadow-sm',
    success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 border border-success-200/50 dark:border-success-800/50 shadow-sm',
    warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300 border border-warning-200/50 dark:border-warning-800/50 shadow-sm',
    danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300 border border-danger-200/50 dark:border-danger-800/50 shadow-sm',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 shadow-sm',
    secondary: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 shadow-sm',
    gradient: 'bg-gradient-to-r from-primary-500 to-success-500 text-white shadow-md border-0',
    outline: 'bg-transparent border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50',
  }
  
  const sizes = {
    xs: 'px-1.5 py-0.5 text-2xs min-h-5',
    sm: 'px-2 py-0.5 text-xs min-h-6',
    md: 'px-2.5 py-1 text-sm min-h-7',
    lg: 'px-3 py-1.5 text-sm min-h-8',
    xl: 'px-4 py-2 text-base min-h-10',
  }
  
  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
  }

  const BadgeComponent = animate ? motion.span : 'span'
  
  const motionProps = animate
    ? {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        whileHover: { scale: 1.05, y: -1 },
        whileTap: { scale: 0.95 },
        transition: { type: 'spring', stiffness: 400, damping: 20 },
      }
    : {}

  const { 
    ...badgeProps 
  } = props

  return (
    <BadgeComponent
      role="status"
      aria-label={typeof children === 'string' ? children : undefined}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...(animate ? motionProps : {})}
      {...badgeProps}
    >
      {icon && (
        <span className={cn(iconSizes[size], children && 'mr-1.5')}>
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
      {removable && onRemove && (
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className={cn(
            'ml-1.5 flex-shrink-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors',
            iconSizes[size]
          )}
          aria-label="Remove badge"
        >
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </motion.button>
      )}
    </BadgeComponent>
  )
}

interface StatusBadgeProps {
  status: 'pending' | 'running' | 'passed' | 'failed' | 'completed' | 'error'
  animate?: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  animate = false,
  className,
}) => {
  const statusConfig = {
    pending: { variant: 'secondary' as const, text: 'Pending' },
    running: { variant: 'info' as const, text: 'Running' },
    passed: { variant: 'success' as const, text: 'Passed' },
    failed: { variant: 'danger' as const, text: 'Failed' },
    completed: { variant: 'success' as const, text: 'Completed' },
    error: { variant: 'danger' as const, text: 'Error' },
  }
  
  const config = statusConfig[status]
  
  return (
    <Badge
      variant={config.variant}
      animate={animate}
      className={className}
    >
      {config.text}
    </Badge>
  )
}

interface RiskBadgeProps {
  score?: number | null
  label?: string
  animate?: boolean
  className?: string
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  label,
  animate = false,
  className,
}) => {
  const getRiskConfig = (score?: number | null) => {
    if (score === null || score === undefined) {
      return { variant: 'secondary' as const, text: label || 'N/A' }
    } else if (score < 0.3) {
      return { variant: 'success' as const, text: 'Low Risk' }
    } else if (score < 0.7) {
      return { variant: 'warning' as const, text: 'Medium Risk' }
    } else if (score < 1.0) {
      return { variant: 'danger' as const, text: 'High Risk' }
    } else {
      return { variant: 'danger' as const, text: 'Critical Risk' }
    }
  }
  
  const config = getRiskConfig(score)
  
  return (
    <Badge
      variant={config.variant}
      animate={animate}
      className={className}
    >
      {config.text}
    </Badge>
  )
}

interface ComplianceBadgeProps {
  type: string
  animate?: boolean
  className?: string
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  type,
  animate = false,
  className,
}) => {
  const complianceColors: Record<string, string> = {
    HIPAA: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50 shadow-sm',
    PCI_DSS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50 shadow-sm',
    GDPR: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm',
    CCPA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50 shadow-sm',
    PII: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 shadow-sm',
    PHI: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 shadow-sm',
  }
  
  const BadgeComponent = animate ? motion.span : 'span'
  
  const motionProps = animate
    ? {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        whileHover: { scale: 1.05, y: -1 },
        whileTap: { scale: 0.95 },
        transition: { type: 'spring', stiffness: 400, damping: 20 },
      }
    : {}

  return (
    <BadgeComponent
      role="status"
      aria-label={`${type} compliance badge`}
      className={cn(
        'inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 select-none',
        complianceColors[type] || complianceColors.PII,
        className
      )}
      {...(animate ? motionProps : {})}
    >
      <span className="truncate">{type}</span>
    </BadgeComponent>
  )
}