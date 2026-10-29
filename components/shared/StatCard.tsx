import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'green' | 'orange' | 'red' | 'default'
  className?: string
  href?: string
}

const colorMap = {
  blue:    { icon: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  green:   { icon: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  orange:  { icon: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  red:     { icon: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  default: { icon: 'text-muted-foreground', bg: 'bg-secondary', border: 'border-border' },
}

export function StatCard({ title, value, icon: Icon, trend, color = 'default', className, href }: StatCardProps) {
  const c = colorMap[color]
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-[10px] md:text-xs text-muted-foreground font-medium leading-tight">{title}</p>
        <div className={cn('p-1 md:p-1.5 rounded-lg border shrink-0', c.bg, c.border)}>
          <Icon className={cn('w-3 h-3 md:w-3.5 md:h-3.5', c.icon)} />
        </div>
      </div>
      <div>
        <p className="text-xl md:text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {trend && (
          <p className={cn('text-xs mt-1', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </>
  )

  const base = cn('bg-card border border-border rounded-xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 hover:border-primary/20 transition-colors', href && 'cursor-pointer hover:bg-secondary/30', className)

  if (href) return <Link href={href} className={base}>{inner}</Link>
  return <div className={base}>{inner}</div>
}
