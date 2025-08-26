import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils'

interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'default' | 'elevated' | 'floating' | 'frosted' | 'tinted'
  intensity?: 'light' | 'medium' | 'strong'
  gradient?: 'none' | 'subtle' | 'vibrant' | 'rainbow'
  hover?: boolean
  glow?: boolean
  border?: boolean
  animated?: boolean
  children: React.ReactNode
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  intensity = 'medium',
  gradient = 'subtle',
  hover = false,
  glow = false,
  border = true,
  animated = true,
  className,
  children,
  ...props
}) => {
  const baseStyles = 'relative rounded-2xl transition-all duration-300 overflow-hidden'
  
  const variants = {
    default: 'bg-white/10 dark:bg-white/5 backdrop-blur-md',
    elevated: 'bg-white/20 dark:bg-white/10 backdrop-blur-lg shadow-xl',
    floating: 'bg-white/15 dark:bg-white/8 backdrop-blur-xl shadow-2xl',
    frosted: 'bg-white/25 dark:bg-gray-900/60 backdrop-blur-2xl',
    tinted: 'bg-gradient-to-br from-white/20 via-white/10 to-white/5 dark:from-gray-800/60 dark:via-gray-900/40 dark:to-gray-950/20 backdrop-blur-lg'
  }
  
  const intensities = {
    light: 'backdrop-blur-sm',
    medium: 'backdrop-blur-md',
    strong: 'backdrop-blur-xl'
  }
  
  const gradients = {
    none: '',
    subtle: 'before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none',
    vibrant: 'before:absolute before:inset-0 before:bg-gradient-to-br before:from-blue-500/10 before:via-purple-500/5 before:to-cyan-500/10 before:pointer-events-none',
    rainbow: 'before:absolute before:inset-0 before:bg-gradient-to-br before:from-pink-500/10 before:via-blue-500/10 before:via-green-500/10 before:to-yellow-500/10 before:pointer-events-none before:animate-pulse'
  }
  
  const borderStyles = border ? 'border border-white/20 dark:border-gray-800/30' : ''
  const glowStyles = glow ? 'shadow-2xl shadow-blue-500/20 dark:shadow-blue-400/10' : ''
  const hoverStyles = hover ? 'hover:scale-[1.02] hover:shadow-2xl hover:bg-white/20 dark:hover:bg-white/10' : ''

  const CardComponent = animated ? motion.div : 'div'
  
  const motionProps = animated ? {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    whileHover: hover ? { y: -4, scale: 1.02 } : undefined,
    transition: { 
      type: "spring", 
      stiffness: 400, 
      damping: 25,
      opacity: { duration: 0.3 },
      y: { duration: 0.4 },
      scale: { duration: 0.2 }
    }
  } : {}

  return (
    <CardComponent
      className={cn(
        baseStyles,
        variants[variant],
        intensities[intensity],
        gradients[gradient],
        borderStyles,
        glowStyles,
        hoverStyles,
        className
      )}
      {...(animated ? motionProps : {})}
      {...props}
    >
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Ambient glow effect */}
      {glow && (
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-lg opacity-70 -z-10 animate-pulse" />
      )}
    </CardComponent>
  )
}

interface GlassHeaderProps {
  children: React.ReactNode
  className?: string
}

export const GlassHeader: React.FC<GlassHeaderProps> = ({ children, className }) => (
  <div className={cn("p-6 border-b border-white/10 dark:border-gray-700/30", className)}>
    {children}
  </div>
)

interface GlassContentProps {
  children: React.ReactNode
  className?: string
}

export const GlassContent: React.FC<GlassContentProps> = ({ children, className }) => (
  <div className={cn("p-6", className)}>
    {children}
  </div>
)

interface GlassFooterProps {
  children: React.ReactNode
  className?: string
}

export const GlassFooter: React.FC<GlassFooterProps> = ({ children, className }) => (
  <div className={cn("p-6 border-t border-white/10 dark:border-gray-700/30", className)}>
    {children}
  </div>
)