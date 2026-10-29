import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function SectionCard({ title, description, actions, children, className, noPadding }: SectionCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            {title && <p className="text-sm font-medium">{title}</p>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </div>
  )
}
