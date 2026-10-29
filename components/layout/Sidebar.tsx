'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  Megaphone,
  TrendingUp,
  FileText,
  Hammer,
  FolderKanban,
  Bot,
  CheckSquare,
  Calendar,
  DollarSign,
  Settings,
  Zap,
  Mail,
  X,
  FolderOpen,
  Lightbulb,
  Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/empresas', label: 'Empresas', icon: Building2 },
      { href: '/campanas', label: 'Campañas', icon: Megaphone },
      { href: '/ventas', label: 'Ventas', icon: TrendingUp },
      { href: '/propuestas', label: 'Propuestas', icon: FileText },
      { href: '/emails', label: 'Emails', icon: Mail },
      { href: '/llamadas', label: 'Llamadas', icon: Phone },
      { href: '/documentos', label: 'Documentos', icon: FolderOpen },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/produccion', label: 'Producción', icon: Hammer },
      { href: '/proyectos', label: 'Proyectos', icon: FolderKanban },
      { href: '/tareas', label: 'Tareas', icon: CheckSquare },
      { href: '/calendario', label: 'Calendario', icon: Calendar },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/agentes', label: 'Agentes IA', icon: Bot },
      { href: '/mejoras', label: 'Mejoras', icon: Lightbulb },
      { href: '/finanzas', label: 'Finanzas', icon: DollarSign },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        // Base: fixed en móvil, relativo en desktop
        'fixed inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0 h-screen border-r border-border bg-sidebar',
        'transition-transform duration-200 ease-in-out',
        // Desktop: siempre visible, posición estática
        'md:relative md:w-56 md:translate-x-0 md:z-auto',
        // Móvil: oculto por defecto, visible cuando open=true
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
    >
      {/* Logo + botón cerrar (solo móvil) */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Nexus</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 mb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : '')} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground/50 font-mono">v0.1.0 · Nexus</p>
      </div>
    </aside>
  )
}
