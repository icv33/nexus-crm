'use client'

import { useQuery } from '@tanstack/react-query'
import { Calendar, Plus, Clock, MapPin, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const { data } = useQuery({
    queryKey: ['reuniones'],
    queryFn: async () => {
      const res = await fetch('/api/calendar')
      return res.json()
    },
  })

  const reuniones = data?.reuniones ?? []
  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOfMonth = startOfMonth(currentDate).getDay()

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Calendario"
        description="Reuniones y agenda"
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> Nueva reunión
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendario */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          {/* Nav mes */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</Button>
            </div>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 mb-2">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Grid días */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (firstDayOfMonth + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map((day) => {
              const dayReuniones = reuniones.filter((r: any) => isSameDay(new Date(r.fechaInicio), day))
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center relative cursor-pointer hover:bg-secondary transition-colors',
                    isToday(day) && 'bg-primary/10 border border-primary/30'
                  )}
                >
                  <span className={cn('text-xs', isToday(day) ? 'text-primary font-semibold' : 'text-foreground')}>
                    {format(day, 'd')}
                  </span>
                  {dayReuniones.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayReuniones.slice(0, 3).map((_r: unknown, i: number) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Reuniones próximas */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-medium mb-4">Próximas reuniones</p>
          {reuniones.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin reuniones"
              description="Aquí aparecerán tus reuniones con leads"
            />
          ) : (
            <div className="space-y-3">
              {reuniones.slice(0, 8).map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg bg-secondary border border-border">
                  <p className="text-xs font-medium">{r.titulo}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(r.fechaInicio), "dd MMM 'a las' HH:mm", { locale: es })}
                    </span>
                  </div>
                  {r.enlaceMeet && (
                    <a href={r.enlaceMeet} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline">
                      <Link2 className="w-2.5 h-2.5" /> Unirse a la reunión
                    </a>
                  )}
                  {r.lead && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Lead: {r.lead.nombre}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Config calendario */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">Configuración</p>
            <div className="space-y-1">
              <ConfigRow label="Horario" value="L-V 10-14 y 17-20" />
              <ConfigRow label="Duración" value="30 min" />
              <ConfigRow label="Margen" value="15 min" />
              <ConfigRow label="Máx. por día" value="3 reuniones" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-medium">{value}</span>
    </div>
  )
}
