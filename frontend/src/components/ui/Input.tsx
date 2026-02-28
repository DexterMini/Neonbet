import * as React from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  success?: boolean
  icon?: React.ReactNode
  rightElement?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, success, icon, rightElement, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const inputId = id || React.useId()
    const isPassword = type === 'password'

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-small font-medium text-muted-light"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={isPassword && showPassword ? 'text' : type}
            className={cn(
              'w-full h-11 bg-background-elevated border rounded-xl text-white text-body',
              'placeholder:text-muted transition-all duration-200',
              'focus:outline-none focus:ring-2',
              icon ? 'pl-11 pr-4' : 'px-4',
              (isPassword || rightElement) && 'pr-11',
              error
                ? 'border-accent-red/50 focus:border-accent-red focus:ring-accent-red/20'
                : success
                  ? 'border-accent-green/50 focus:border-accent-green focus:ring-accent-green/20'
                  : 'border-border focus:border-brand/50 focus:ring-brand/15',
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-muted-light transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {rightElement && !isPassword && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
          {success && !error && !isPassword && !rightElement && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-accent-green">
              <Check className="h-4 w-4" />
            </div>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-tiny text-accent-red">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-tiny text-muted">{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
