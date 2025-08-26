import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'default' | 'compact' | 'glass' | 'gradient' | 'border'
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none'
  hover?: boolean
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'soft'
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  animated?: boolean
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  hover = false,
  shadow = 'soft',
  rounded = 'xl',
  animated = true,
  className,
  children,
  ...props
}) => {
  const baseStyles = 'border transition-all duration-300'
  
  const variants = {
    default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    compact: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    glass: 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-white/20 dark:border-gray-800/20',
    gradient: 'bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950 border-gray-200 dark:border-gray-700',
    border: 'bg-transparent border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
  }
  
  const paddings = {
    none: 'p-0',
    xs: 'p-2',
    sm: variant === 'compact' ? 'p-3' : 'p-4',
    md: variant === 'compact' ? 'p-4' : 'p-6',
    lg: variant === 'compact' ? 'p-6' : 'p-8',
    xl: 'p-10',
  }
  
  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    soft: 'shadow-soft hover:shadow-soft-lg',
  }
  
  const roundedStyles = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
  }
  
  const hoverStyles = hover
    ? 'hover:shadow-soft-lg hover:-translate-y-1 hover:scale-[1.01] cursor-pointer transform-gpu'
    : ''

  const CardComponent = (hover || animated) ? motion.div : 'div'
  
  const motionProps = (hover || animated) ? {
    initial: animated ? { opacity: 0, y: 20 } : undefined,
    animate: animated ? { opacity: 1, y: 0 } : undefined,
    transition: { type: "spring", stiffness: 260, damping: 20 },
    ...(hover ? {
      whileHover: { y: -4, scale: 1.01 },
      whileTap: { scale: 0.99 },
    } : {})
  } : {}

  return (
    <CardComponent
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        shadowStyles[shadow],
        roundedStyles[rounded],
        hoverStyles,
        className
      )}
      {...((hover || animated) ? motionProps : {})}
      {...props}
    >
      {children}
    </CardComponent>
  )
}

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  children: React.ReactNode
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={cn(
        'mb-4 pb-3 border-b border-gray-200/60 dark:border-gray-700/60',
        'transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface CardTitleProps extends Omit<React.HTMLAttributes<HTMLHeadingElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  children: React.ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  gradient?: boolean
}

export const CardTitle: React.FC<CardTitleProps> = ({
  size = 'md',
  gradient = false,
  className,
  children,
  ...props
}) => {
  const sizes = {
    xs: 'text-base font-semibold',
    sm: 'text-lg font-semibold',
    md: 'text-xl font-semibold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-bold',
  }
  
  return (
    <motion.h3
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className={cn(
        'transition-colors duration-300',
        gradient 
          ? 'text-gradient bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent'
          : 'text-gray-900 dark:text-gray-100',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.h3>
  )
}

interface CardContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  children: React.ReactNode
}

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={cn(
        'text-gray-600 dark:text-gray-400 transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface CardFooterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  children: React.ReactNode
}

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className={cn(
        'mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60',
        'transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}