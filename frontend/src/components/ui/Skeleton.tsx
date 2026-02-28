import { cn } from '@/lib/utils'

/* ─── Skeleton ─── */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface-light shimmer',
        className
      )}
      {...props}
    />
  )
}

/* ─── Skeleton variants for common patterns ─── */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface rounded-2xl border border-border p-6 space-y-4', className)}>
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={2} />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }
  return <Skeleton className={cn('rounded-full', sizes[size])} />
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar }
