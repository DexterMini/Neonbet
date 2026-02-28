import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:  'bg-surface-lighter text-muted-light',
        brand:    'bg-brand/10 text-brand border border-brand/20',
        success:  'bg-accent-green/10 text-accent-green border border-accent-green/20',
        danger:   'bg-accent-red/10 text-accent-red border border-accent-red/20',
        warning:  'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
        info:     'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
        outline:  'border border-border-light text-muted-light',
      },
      size: {
        sm: 'text-2xs px-1.5 py-0.5',
        md: 'text-tiny px-2 py-0.5',
        lg: 'text-small px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-accent-green',
            variant === 'danger' && 'bg-accent-red',
            variant === 'warning' && 'bg-accent-amber',
            variant === 'info' && 'bg-accent-blue',
            variant === 'brand' && 'bg-brand',
            (!variant || variant === 'default' || variant === 'outline') && 'bg-muted-light',
          )}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
