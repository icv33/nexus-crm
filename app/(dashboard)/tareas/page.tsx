'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Plus, AlertTriangle, Clock, ExternalLink, ChevronDown, ChevronRight, Phone, Globe, Trash2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const TIPO_LABEL: Record<string, { icon: string; label: string; color: string }> = {
  aprobacion:  { icon: '✅', label: 'Aprobación',  color: 'text-amber-400' },
  accion:      { icon: '⚡', label: 'Acción',       color: 'text-blue-400' },
  revision:    { icon: '🔍', label: 'Revisión',     color: 'text-purple-400' },
  llamada:     { icon: '📞', label: 'Llamada',      color: 'text-green-400' },
  seguimiento: { icon: '🔄', label: 'Seguimiento',  color: 'text-sky-400' },
}

type Filtro = 'pendiente' | 'aprobacion' | 'todas'

export default function TareasPage() {
  const [filtro, setFiltro] = useState<Filtro>('pendiente')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sinEmailExpanded, setSinEmailExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tareas', filtro],
    queryFn: async () => {
      const params = filtro !== 'todas' ? '?estado=pendiente' : ''
      const res = await fetch(`/api/tareas${params}`)
      return res.json()
    },
  })

  const completarMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tareas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'completada' }) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  })

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      setDeletingId(null)
      qc.invalidateQueries({ queryKey: ['tareas'] })
    },
    onError: () => setDeletingId(null),
  })

  const createMutation = useMutation({
    mutationFn: async (titulo: string) => {
      const res = await fetch('/api/tareas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, origen: 'manual' }) })
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tareas'] }); setShowNewTask(false); setNewTaskTitle('') },
  })

  const allTareas: any[] = (data?.tareas ?? []).filter((t: any) => {
    if (t.tipo === 'llamada') return false  // se muestran como resumen en la sección de leads sin email
    if (filtro === 'aprobacion') return t.tipo === 'aprobacion'
    return true
  })

  const aprobacionesPendientes = (data?.tareas ?? []).filter((t: any) => t.tipo === 'aprobacion' && t.estado === 'pendiente').length

  const descartarMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'descartado' }) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads-sin-email-alta'] }),
  })

  const aprobarMutation = useMutation({
    mutationFn: async (lead: any) => {
      await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Contactar manualmente: ${lead.nombre}`,
          descripcion: `Lead de alta prioridad sin email.${lead.telefono ? ` Teléfono: ${lead.telefono}` : ''}${lead.web ? ` Web: ${lead.web}` : ''}`,
          tipo: 'aprobacion',
          prioridad: 'alta',
          leadId: lead.id,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads-sin-email-alta'] })
      qc.invalidateQueries({ queryKey: ['tareas'] })
    },
  })

  const { data: sinEmailData } = useQuery({
    queryKey: ['leads-sin-email-alta'],
    queryFn: async () => {
      const res = await fetch('/api/leads?prioridad=alta&tieneEmail=no')
      return res.json()
    },
  })
  const aprobacionLeadIds = new Set(
    allTareas.filter((t: any) => t.tipo === 'aprobacion' && t.lead).map((t: any) => t.lead.id)
  )
  // Solo leads que se pueden llamar (tienen teléfono). Sin email Y sin teléfono → aparcados, no mostrar.
  const leadsSinEmail: any[] = (sinEmailData?.leads ?? []).filter(
    (l: any) =>
      !['descartado', 'perdido', 'ganado'].includes(l.estado) &&
      !aprobacionLeadIds.has(l.id) &&
      !!l.telefono
  )

  // Agrupar por lead
  const byLead = new Map<string, { lead: any; tareas: any[] }>()
  const sinLead: any[] = []

  for (const t of allTareas) {
    if (t.lead) {
      if (!byLead.has(t.lead.id)) byLead.set(t.lead.id, { lead: t.lead, tareas: [] })
      byLead.get(t.lead.id)!.tareas.push(t)
    } else {
      sinLead.push(t)
    }
  }

  // Ordenar: primero los que tienen aprobación pendiente, luego por número de tareas
  const groups = [...byLead.values()].sort((a, b) => {
    const aPrio = a.tareas.some((t) => t.tipo === 'aprobacion') ? 0 : 1
    const bPrio = b.tareas.some((t) => t.tipo === 'aprobacion') ? 0 : 1
    return aPrio - bPrio || b.tareas.length - a.tareas.length
  })

  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Tareas"
        description={`${data?.total ?? 0} tareas pendientes`}
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNewTask(true)}>
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </Button>
        }
      />

      {showNewTask && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-card border border-primary/20 rounded-xl">
          <Input
            className="flex-1 h-8 text-sm bg-secondary border-border"
            placeholder="Título de la nueva tarea..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskTitle.trim()) createMutation.mutate(newTaskTitle.trim())
              if (e.key === 'Escape') { setShowNewTask(false); setNewTaskTitle('') }
            }}
            autoFocus
          />
          <Button size="sm" className="h-8 text-xs" disabled={!newTaskTitle.trim() || createMutation.isPending} onClick={() => newTaskTitle.trim() && createMutation.mutate(newTaskTitle.trim())}>
            {createMutation.isPending ? 'Creando...' : 'Crear'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowNewTask(false); setNewTaskTitle('') }}>Cancelar</Button>
        </div>
      )}

      {aprobacionesPendientes > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-400">
            {aprobacionesPendientes} {aprobacionesPendientes === 1 ? 'aprobación pendiente' : 'aprobaciones pendientes'} — requieren tu decisión
          </p>
          <button onClick={() => setFiltro('aprobacion')} className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-medium">Ver →</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-5">
        {(['pendiente', 'aprobacion', 'todas'] as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', filtro === f ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground border-border hover:text-foreground')}>
            {f === 'pendiente' ? 'Pendientes' : f === 'aprobacion' ? `Aprobaciones${aprobacionesPendientes > 0 ? ` (${aprobacionesPendientes})` : ''}` : 'Todas'}
          </button>
        ))}
      </div>

      {/* Leads sin email — colapsado por defecto */}
      {leadsSinEmail.length > 0 && (filtro === 'pendiente' || filtro === 'todas') && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <button
            onClick={() => setSinEmailExpanded(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
          >
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-left text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{leadsSinEmail.length} leads sin correo</span> por llamar
            </span>
            {sinEmailExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          </button>

          {sinEmailExpanded && (
            <div className="border-t border-border divide-y divide-border/50">
              {leadsSinEmail.map((lead: any) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nombre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{lead.sector ?? ''}{lead.ciudad ? ` · ${lead.ciudad}` : ''}</span>
                      <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{lead.telefono}</span>
                      {lead.web && <span className="text-[10px] text-blue-400 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />web</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{lead.puntuacion}/10</span>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => { e.preventDefault(); descartarMutation.mutate(lead.id) }}
                      className="text-[10px] text-muted-foreground hover:text-red-400 border border-border hover:border-red-500/30 px-2 py-1 rounded-lg transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}</div>
      ) : allTareas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState icon={CheckSquare} title="Sin tareas pendientes" description="¡Todo al día!" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Grupos por lead */}
          {groups.map(({ lead, tareas }) => {
            const isOpen = !collapsed.has(lead.id)
            const tieneAprobacion = tareas.some((t) => t.tipo === 'aprobacion')
            return (
              <div key={lead.id} className={cn('bg-card border rounded-xl overflow-hidden', tieneAprobacion ? 'border-amber-500/30' : 'border-border')}>
                {/* Header del lead */}
                <button
                  onClick={() => toggleCollapse(lead.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{lead.nombre}</span>
                    {lead.sector && <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded-full shrink-0">{lead.sector}</span>}
                    {tieneAprobacion && <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">requiere aprobación</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}</span>
                  <Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </button>

                {/* Lista de tareas */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {tareas.map((tarea: any) => (
                      <TareaRow key={tarea.id} tarea={tarea} onCompletar={() => completarMutation.mutate(tarea.id)} onEliminar={() => eliminarMutation.mutate(tarea.id)} isPending={completarMutation.isPending} isDeleting={deletingId === tarea.id} anyDeleting={deletingId !== null} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Tareas sin lead */}
          {sinLead.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <span className="font-medium text-sm text-muted-foreground">General</span>
                <span className="text-xs text-muted-foreground">{sinLead.length} {sinLead.length === 1 ? 'tarea' : 'tareas'}</span>
              </div>
              <div className="divide-y divide-border/50">
                {sinLead.map((tarea: any) => (
                  <TareaRow key={tarea.id} tarea={tarea} onCompletar={() => completarMutation.mutate(tarea.id)} onEliminar={() => eliminarMutation.mutate(tarea.id)} isPending={completarMutation.isPending} isDeleting={deletingId === tarea.id} anyDeleting={deletingId !== null} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TareaRow({ tarea, onCompletar, onEliminar, isPending, isDeleting, anyDeleting }: { tarea: any; onCompletar: () => void; onEliminar: () => void; isPending: boolean; isDeleting: boolean; anyDeleting: boolean }) {
  const tipo = TIPO_LABEL[tarea.tipo] ?? { icon: '•', label: tarea.tipo, color: 'text-muted-foreground' }
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors group/row', tarea.tipo === 'aprobacion' && 'bg-amber-500/5')}>
      <button
        onClick={onCompletar}
        className="w-4 h-4 rounded border border-border bg-secondary hover:bg-primary/10 hover:border-primary/40 shrink-0 mt-0.5 flex items-center justify-center transition-colors"
      >
        {isPending && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">
            <span className="mr-1.5">{tipo.icon}</span>
            {tarea.titulo}
          </p>
          <PriorityBadge priority={tarea.prioridad} />
        </div>
        {tarea.descripcion && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{tarea.descripcion}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={cn('text-[10px]', tipo.color)}>{tipo.label}</span>
          {tarea.vencimiento && (
            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {format(new Date(tarea.vencimiento), 'dd MMM', { locale: es })}
            </span>
          )}
          {tarea.proyecto && (
            <span className="text-[10px] text-muted-foreground">{tarea.proyecto.nombre}</span>
          )}
        </div>
      </div>
      <button
        onClick={onEliminar}
        disabled={isDeleting || anyDeleting}
        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5 p-1 rounded hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Eliminar tarea"
      >
        {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
