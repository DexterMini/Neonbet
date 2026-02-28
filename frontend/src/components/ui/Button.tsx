import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 font-medium',
    'rounded-xl transition-all duration-200 ease-out',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:scale-[0.98]',
    'select-none whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-brand text-background-deep font-semibold',
          'hover:bg-brand-light',
          'shadow-soft-sm shadow-brand/15',
          'hover:shadow-soft hover:shadow-brand/20',
        ].join(' '),
        secondary: [
          'bg-surface-light text-white border border-border-light',
          'hover:bg-surface-lighter hover:border-border-accent',
        ].join(' '),
        ghost: [
          'text-muted-light',
          'hover:text-white hover:bg-white/[0.04]',
        ].join(' '),
        danger: [
          'bg-accent-red/10 text-accent-red border border-accent-red/20',
          'hover:bg-accent-red/15 hover:border-accent-red/30',
        ].join(' '),
        success: [
          'bg-accent-green/10 text-accent-green border border-accent-green/20',
          'hover:bg-accent-green/15 hover:border-accent-green/30',
        ].join(' '),
        outline: [
          'border border-border-light text-muted-light',
          'hover:border-brand/40 hover:text-brand-light hover:bg-brand/[0.04]',
        ].join(' '),
        link: [
          'text-brand underline-offset-4',
          'hover:text-brand-light hover:underline',
          'p-0 h-auto',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-small rounded-lg',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        xl: 'h-14 px-8 text-base font-semibold',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
