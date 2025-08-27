import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    direction: 'up' | 'down'
    label?: string
  }
  variant?: 'default' | 'gradient' | 'glass' | 'minimal' | 'elevated'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan' | 'gray'
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'responsive'
  animated?: boolean
  loading?: boolean
  className?: string
  onClick?: () => void
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  color = 'blue',
  size = 'md',
  animated = true,
  loading = false,
  className,
  onClick
}) => {
  const isClickable = !!onClick

  const colorVariants = {
    blue: {
      gradient: 'from-blue-600 to-blue-700',
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      glow: 'shadow-blue-500/25'
    },
    green: {
      gradient: 'from-green-600 to-green-700',
      bg: 'bg-green-500',
      text: 'text-green-600',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      glow: 'shadow-green-500/25'
    },
    yellow: {
      gradient: 'from-yellow-500 to-orange-600',
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      glow: 'shadow-yellow-500/25'
    },
    red: {
      gradient: 'from-red-600 to-red-700',
      bg: 'bg-red-500',
      text: 'text-red-600',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      glow: 'shadow-red-500/25'
    },
    purple: {
      gradient: 'from-purple-600 to-purple-700',
      bg: 'bg-purple-500',
      text: 'text-purple-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      glow: 'shadow-purple-500/25'
    },
    cyan: {
      gradient: 'from-cyan-600 to-cyan-700',
      bg: 'bg-cyan-500',
      text: 'text-cyan-600',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      glow: 'shadow-cyan-500/25'
    },
    gray: {
      gradient: 'from-gray-600 to-gray-700',
      bg: 'bg-gray-500',
      text: 'text-gray-600',
      iconBg: 'bg-gray-100 dark:bg-gray-800',
      glow: 'shadow-gray-500/25'
    }
  }

  const sizeVariants = {
    sm: {
      padding: 'p-4',
      title: 'text-xs',
      value: 'text-lg',
      description: 'text-xs',
      icon: 'w-4 h-4',
      iconContainer: 'w-8 h-8'
    },
    md: {
      padding: 'p-4 xs:p-5 sm:p-6',
      title: 'text-xs xs:text-sm',
      value: 'text-xl xs:text-2xl sm:text-2xl',
      description: 'text-xs xs:text-sm',
      icon: 'w-4 h-4 xs:w-5 xs:h-5',
      iconContainer: 'w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10'
    },
    lg: {
      padding: 'p-6 xs:p-7 sm:p-8',
      title: 'text-sm xs:text-base',
      value: 'text-2xl xs:text-3xl sm:text-3xl',
      description: 'text-sm xs:text-base',
      icon: 'w-5 h-5 xs:w-6 xs:h-6',
      iconContainer: 'w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12'
    },
    xl: {
      padding: 'p-8 xs:p-9 sm:p-10',
      title: 'text-base xs:text-lg',
      value: 'text-3xl xs:text-4xl sm:text-4xl',
      description: 'text-base xs:text-lg',
      icon: 'w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8',
      iconContainer: 'w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16'
    },
    responsive: {
      padding: 'p-3 xs:p-4 sm:p-5 md:p-6 lg:p-8',
      title: 'text-xs xs:text-sm sm:text-base',
      value: 'text-lg xs:text-xl sm:text-2xl md:text-3xl',
      description: 'text-xs xs:text-sm',
      icon: 'w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6',
      iconContainer: 'w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 md:w-12 md:h-12'
    }
  }

  const cardVariants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft',
    gradient: `bg-gradient-to-br ${colorVariants[color].gradient} text-white shadow-lg`,
    glass: 'bg-white/10 dark:bg-white/5 backdrop-blur-lg border border-white/20 dark:border-gray-800/30 shadow-soft',
    minimal: 'bg-transparent',
    elevated: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-lg'
  }

  const colors = colorVariants[color]
  const sizes = sizeVariants[size]

  const cardClasses = cn(
    'relative rounded-2xl transition-all duration-300 overflow-hidden',
    cardVariants[variant],
    sizes.padding,
    isClickable && 'cursor-pointer hover:scale-[1.02] hover:shadow-soft-lg',
    variant === 'gradient' && `shadow-xl ${colors.glow}`,
    className
  )

  const CardComponent = animated ? motion.div : 'div'

  const motionProps = animated ? {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    whileHover: isClickable ? { y: -4, scale: 1.02 } : undefined,
    transition: { 
      type: "spring", 
      stiffness: 400, 
      damping: 25,
      staggerChildren: 0.1
    }
  } : {}

  const childVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 }
  }

  return (
    <CardComponent
      className={cardClasses}
      onClick={onClick}
      {...(animated ? motionProps : {})}
    >
      {/* Background decoration for gradient variant */}
      {variant === 'gradient' && (
        <>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12" />
        </>
      )}

      {/* Glass reflection for glass variant */}
      {variant === 'glass' && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <motion.div
            variants={childVariants}
            className={cn(
              'font-medium mb-2 tracking-wide',
              sizes.title,
              variant === 'gradient' 
                ? 'text-white/90' 
                : variant === 'glass'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {title}
          </motion.div>

          {/* Value */}
          <motion.div
            variants={childVariants}
            className={cn(
              'font-bold tracking-tight mb-2',
              sizes.value,
              variant === 'gradient' 
                ? 'text-white' 
                : variant === 'glass'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-900 dark:text-white'
            )}
          >
            {loading ? (
              <div className={cn(
                'bg-gray-200 dark:bg-gray-700 rounded animate-pulse',
                size === 'sm' ? 'h-5 w-16' :
                size === 'md' ? 'h-8 w-24' :
                size === 'lg' ? 'h-10 w-32' : 'h-12 w-40'
              )} />
            ) : (
              value
            )}
          </motion.div>

          {/* Description */}
          {description && (
            <motion.div
              variants={childVariants}
              className={cn(
                sizes.description,
                variant === 'gradient' 
                  ? 'text-white/80' 
                  : variant === 'glass'
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {description}
            </motion.div>
          )}

          {/* Trend */}
          {trend && (
            <motion.div
              variants={childVariants}
              className="flex items-center mt-3 space-x-1"
            >
              {trend.direction === 'up' ? (
                <TrendingUp className={cn(
                  'w-4 h-4',
                  variant === 'gradient' ? 'text-white' : 'text-green-500'
                )} />
              ) : (
                <TrendingDown className={cn(
                  'w-4 h-4',
                  variant === 'gradient' ? 'text-white' : 'text-red-500'
                )} />
              )}
              <span className={cn(
                'text-sm font-medium',
                variant === 'gradient' 
                  ? 'text-white' 
                  : trend.direction === 'up' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              )}>
                {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className={cn(
                  'text-sm',
                  variant === 'gradient' 
                    ? 'text-white/80' 
                    : 'text-gray-500 dark:text-gray-400'
                )}>
                  {trend.label}
                </span>
              )}
            </motion.div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <motion.div
            variants={childVariants}
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn(
              'flex items-center justify-center rounded-xl ml-4',
              sizes.iconContainer,
              variant === 'gradient' 
                ? 'bg-white/20 backdrop-blur-sm' 
                : variant === 'glass'
                ? 'bg-white/10 backdrop-blur-sm'
                : colors.iconBg
            )}
          >
            <Icon className={cn(
              sizes.icon,
              variant === 'gradient' 
                ? 'text-white drop-shadow-sm' 
                : variant === 'glass'
                ? 'text-gray-700 dark:text-gray-300'
                : colors.text
            )} />
          </motion.div>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-2xl"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-current border-t-transparent rounded-full"
          />
        </motion.div>
      )}

      {/* Interactive glow effect */}
      {isClickable && variant !== 'minimal' && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </CardComponent>
  )
}

// Specialized metric components
export const CounterMetric: React.FC<Omit<MetricCardProps, 'value'> & { 
  count: number 
  target?: number 
  formatter?: (value: number) => string 
}> = ({ 
  count, 
  target, 
  formatter = (n) => n.toLocaleString(),
  ...props 
}) => {
  const percentage = target ? (count / target) * 100 : undefined

  return (
    <MetricCard
      {...props}
      value={formatter(count)}
      trend={percentage ? {
        value: Math.round(percentage),
        direction: percentage >= 50 ? 'up' : 'down',
        label: target ? `of ${formatter(target)}` : undefined
      } : undefined}
    />
  )
}

export const PercentageMetric: React.FC<Omit<MetricCardProps, 'value'> & { 
  percentage: number 
  precision?: number 
}> = ({ 
  percentage, 
  precision = 1,
  ...props 
}) => (
  <MetricCard
    {...props}
    value={`${percentage.toFixed(precision)}%`}
    color={
      percentage >= 80 ? 'red' :
      percentage >= 50 ? 'yellow' :
      percentage >= 40 ? 'green' : 'green'
    }
  />
)

export const DurationMetric: React.FC<Omit<MetricCardProps, 'value'> & { 
  milliseconds: number 
}> = ({ 
  milliseconds,
  ...props 
}) => {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <MetricCard
      {...props}
      value={formatDuration(milliseconds)}
      color={
        milliseconds < 100 ? 'green' :
        milliseconds < 500 ? 'yellow' : 'red'
      }
    />
  )
}