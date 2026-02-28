import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="mb-4 rounded-2xl bg-surface-light p-4">
          <Icon className="h-8 w-8 text-muted" />
        </div>
      )}
      <h3 className="text-h4 text-white mb-1">{title}</h3>
      {description && (
        <p className="text-small text-muted-light max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={action.onClick}
          className="mt-5"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
