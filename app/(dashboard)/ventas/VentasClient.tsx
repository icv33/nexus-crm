'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PageHeader } from '@/components/shared/PageHeader'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { GripVertical } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { id: 'nuevo',       label: 'Nuevo',      color: 'border-blue-500/40',   grupo: 'captacion' },
  { id: 'contactado',  label: 'Contactado', color: 'border-blue-400/40',   grupo: 'seguimiento' },
  { id: 'respondio',   label: 'Respondió',  color: 'border-indigo-500/40', grupo: 'activo' },
  { id: 'interesado',  label: 'Interesado', color: 'border-amber-500/40',  grupo: 'activo' },
  { id: 'negociacion', label: 'Con cita',    color: 'border-orange-500/40', grupo: 'activo' },
  { id: 'ganado',      label: 'Ganado',     color: 'border-green-500/40',  grupo: 'cierre' },
  { id: 'perdido',     label: 'Perdido',    color: 'border-red-500/40',    grupo: 'perdido' },
]

const SEMAFORO_DOT: Record<string, string> = {
  verde: 'bg-green-400',
  amarillo: 'bg-yellow-400',
  rojo: 'bg-red-400',
}

function LeadCard({ lead, isDragging = false }: { lead: any; isDragging?: boolean }) {
  const semDot = SEMAFORO_DOT[lead.semaforo ?? 'verde']
  return (
    <div className={cn(
      'bg-card border border-border rounded-lg p-3 space-y-2',
      isDragging && 'opacity-50',
      lead.semaforo === 'rojo' && 'border-red-500/50',
    )}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', semDot)} title={`Semáforo: ${lead.semaforo ?? 'verde'}`} />
          <Link
            href={`/leads/${lead.id}`}
            className="text-xs font-medium leading-tight hover:text-primary transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.nombre}
          </Link>
        </div>
        <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0 cursor-grab mt-0.5" />
      </div>
      {lead.servicioRecomendado && (
        <p className="text-[10px] text-muted-foreground truncate">{lead.servicioRecomendado.replace(/_/g, ' ')}</p>
      )}

      {/* Indicadores de estado accionable */}
      {lead.estado === 'perdido' && (
        <span className="inline-flex items-center gap-1 text-[9px] bg-green-500/15 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full">
          ✉️ Cierre enviado
        </span>
      )}
      {lead.borradorRespuesta && (
        <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
          📝 Borrador pendiente
        </span>
      )}
      {lead.estado === 'reunion_agendada' && !lead.borradorRespuesta && (
        <span className="inline-flex items-center gap-1 text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
          📅 Cita en calendario
        </span>
      )}

      <div className="flex items-center justify-between">
        <PriorityBadge priority={lead.prioridad} />
        <div className="flex items-center gap-1">
          {lead.riesgoComercial === 'alto' && (
            <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded">RIESGO</span>
          )}
          {lead.valorEstimado && (
            <span className="text-[10px] text-green-400 font-medium">
              €{lead.valorEstimado.toLocaleString('es-ES')}
            </span>
          )}
        </div>
      </div>
      {lead.seguimientoCount > 0 && (
        <p className="text-[9px] text-muted-foreground/50">
          {lead.seguimientoCount} seguimiento{lead.seguimientoCount > 1 ? 's' : ''} enviado{lead.seguimientoCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

function SortableLeadCard({ lead }: { lead: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({ colId, children, isOver }: { colId: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: colId })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-2 flex-1 min-h-[120px] p-1.5 rounded-lg border border-dashed transition-colors',
        isOver ? 'bg-primary/10 border-primary/40' : 'bg-secondary/20 border-border'
      )}
    >
      {children}
    </div>
  )
}

export function VentasClient() {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [hideEmpty, setHideEmpty] = useState(true)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data } = useQuery({
    queryKey: ['leads-kanban'],
    queryFn: async () => {
      const res = await fetch('/api/leads?limit=200')
      return res.json()
    },
  })

  const { data: metricas } = useQuery({
    queryKey: ['metricas-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/metricas')
      return res.json()
    },
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads-kanban'] }),
  })

  const leads: any[] = data?.leads ?? []
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  const byColumn = (colId: string) => leads.filter((l) => l.estado === colId)

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  const handleDragOver = (e: any) => setOverId(e.over?.id ?? null)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    setOverId(null)
    if (!over || active.id === over.id) return

    // over.id puede ser el ID de una columna (droppable) o de un lead (sortable)
    const targetColumn = COLUMNS.find((c) => c.id === over.id)
    if (targetColumn) {
      updateMutation.mutate({ id: active.id as string, estado: targetColumn.id })
      return
    }

    // Si es un lead, mover a la columna donde vive ese lead
    const targetLead = leads.find((l) => l.id === over.id)
    const activeLd = leads.find((l) => l.id === active.id)
    if (targetLead && targetLead.estado !== activeLd?.estado) {
      updateMutation.mutate({ id: active.id as string, estado: targetLead.estado })
    }
  }

  const totalPipeline = leads
    .filter((l) => !['perdido', 'descartado'].includes(l.estado))
    .reduce((sum, l) => sum + (l.valorEstimado ?? 0), 0)

  const visibleColumns = hideEmpty
    ? COLUMNS.filter((c) => byColumn(c.id).length > 0)
    : COLUMNS

  const sem = metricas?.semaforo
  const tasaResp = metricas?.emails?.tasaRespuesta ?? 0

  return (
    <div className="max-w-full">
      <PageHeader
        title="Pipeline de Ventas"
        description={`${leads.length} leads · €${totalPipeline.toLocaleString('es-ES')} en pipeline`}
      />

      {/* Semáforo + métricas rápidas */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {sem && (
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Semáforo:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />{sem.verde}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />{sem.amarillo}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{sem.rojo}</span>
          </div>
        )}
        {tasaResp > 0 && (
          <div className="bg-secondary/50 rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
            Respuesta 30d: <span className="text-foreground font-medium">{tasaResp}%</span>
          </div>
        )}
        <button
          onClick={() => setHideEmpty((v) => !v)}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {hideEmpty ? 'Mostrar vacías' : 'Ocultar vacías'}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {visibleColumns.map((col) => {
            const colLeads = byColumn(col.id)
            const isColumnOver = overId === col.id
            return (
              <div key={col.id} className="flex flex-col w-52 shrink-0">
                {/* Column header */}
                <div className={cn(
                  'flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg border-b-2 bg-secondary/60',
                  col.color
                )}>
                  <span className="text-xs font-medium">{col.label}</span>
                  <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md">
                    {colLeads.length}
                  </span>
                </div>

                {/* Drop zone */}
                <SortableContext items={colLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn colId={col.id} isOver={isColumnOver}>
                    {colLeads.map((lead) => (
                      <SortableLeadCard key={lead.id} lead={lead} />
                    ))}
                    {colLeads.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground/50">
                        Vacío
                      </div>
                    )}
                  </DroppableColumn>
                </SortableContext>

                {/* Column total */}
                {colLeads.some((l) => l.valorEstimado) && (
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
                    €{colLeads.reduce((s, l) => s + (l.valorEstimado ?? 0), 0).toLocaleString('es-ES')}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
