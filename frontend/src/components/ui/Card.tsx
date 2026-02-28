import * as React from 'react'
import { cn } from '@/lib/utils'

/* ─── Card ─── */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-2xl border border-border',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

/* ─── Card Header ─── */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 py-5 border-b border-border', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

/* ─── Card Title ─── */
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-h4 text-white', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

/* ─── Card Description ─── */
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-small text-muted-light mt-1', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

/* ─── Card Content ─── */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6', className)}
      {...props}
    />
  )
)
CardContent.displayName = 'CardContent'

/* ─── Card Footer ─── */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 py-4 border-t border-border flex items-center', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
