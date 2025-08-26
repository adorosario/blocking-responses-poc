import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline' | 'gradient'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  rounded?: 'sm' | 'md' | 'lg' | 'full'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = 'lg',
  shadow = 'sm',
  children,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = cn(
    'inline-flex items-center justify-center font-medium transition-all duration-300 focus-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    'active:scale-[0.98] hover:scale-[1.02] transform-gpu',
    fullWidth && 'w-full'
  )
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white border border-transparent',
    secondary: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
    success: 'bg-gradient-to-r from-success-600 to-success-700 hover:from-success-700 hover:to-success-800 text-white border border-transparent',
    danger: 'bg-gradient-to-r from-danger-600 to-danger-700 hover:from-danger-700 hover:to-danger-800 text-white border border-transparent',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent',
    outline: 'border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500',
    gradient: 'bg-gradient-to-r from-primary-500 via-success-500 to-warning-500 hover:from-primary-600 hover:via-success-600 hover:to-warning-600 text-white border border-transparent',
  } as const
  
  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs min-h-8',
    sm: 'px-3 py-2 text-sm min-h-9',
    md: 'px-4 py-2.5 text-sm min-h-10',
    lg: 'px-6 py-3 text-base min-h-12',
    xl: 'px-8 py-4 text-lg min-h-14',
  }
  
  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  }
  
  const roundedStyles = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  }
  
  const shadowStyles = {
    none: '',
    sm: 'shadow-soft hover:shadow-soft-lg',
    md: 'shadow-md hover:shadow-lg',
    lg: 'shadow-lg hover:shadow-xl',
  }

  const isDisabled = disabled || loading
  
  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        roundedStyles[rounded],
        shadowStyles[shadow],
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {/* Left icon or loading spinner */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn('flex items-center', children && 'mr-2')}
        >
          <svg
            className={cn('animate-spin', iconSizes[size])}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </motion.div>
      ) : icon && iconPosition === 'left' ? (
        <motion.span 
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(iconSizes[size], children && 'mr-2')}
        >
          {icon}
        </motion.span>
      ) : null}
      
      {/* Button text */}
      {children && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
      
      {/* Right icon */}
      {icon && iconPosition === 'right' && !loading ? (
        <motion.span 
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(iconSizes[size], children && 'ml-2')}
        >
          {icon}
        </motion.span>
      ) : null}
    </motion.button>
  )
}