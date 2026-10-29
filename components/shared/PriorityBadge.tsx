import { cn } from '@/lib/utils'

const PRIORITY_MAP = {
  alta:  { label: 'Alta',  className: 'text-red-400',    dot: 'bg-red-400' },
  media: { label: 'Media', className: 'text-amber-400',  dot: 'bg-amber-400' },
  baja:  { label: 'Baja',  className: 'text-zinc-400',   dot: 'bg-zinc-400' },
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const config = PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] ?? PRIORITY_MAP.media
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', config.className, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
