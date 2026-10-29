'use client'

import { useSession, signOut } from 'next-auth/react'
import { Bell, Search, Plus, Circle, Sun, Moon, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/ThemeProvider'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { data: session } = useSession()
  const { theme, toggle } = useTheme()
  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'N'

  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-5 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 gap-3">
      {/* Hamburger (solo móvil) + buscador */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground text-sm w-52 md:w-64 cursor-pointer hover:border-primary/30 transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs truncate">Buscar...</span>
          <kbd className="ml-auto text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border hidden md:block">⌘K</kbd>
        </div>
      </div>

      {/* Acciones derecha */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Estado del sistema — oculto en móvil */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground">
          <Circle className="w-2 h-2 fill-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)]" />
          Sistema activo
        </div>

        {/* Nueva acción — oculto en móvil pequeño */}
        <Button size="sm" className="h-8 gap-1.5 text-xs hidden sm:flex">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Nuevo</span>
        </Button>

        {/* Toggle tema */}
        <button
          onClick={toggle}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notificaciones */}
        <button className="relative flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        {/* Perfil */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 rounded-full outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session?.user?.image || ''} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} variant="destructive">
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
