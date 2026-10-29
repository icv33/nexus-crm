'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lightbulb, Check, X, ChevronDown, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const ESTADOS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'implementada', label: 'Implementadas' },
  { key: 'descartada', label: 'Descartadas' },
]

const PRIORIDAD_COLORS: Record<string, string> = {
  alta:  'bg-red-500/10 text-red-400 border-red-500/20',
  media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  baja:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  en_revision: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  implementada:'bg-green-500/10 text-green-400 border-green-500/20',
  descartada:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

export default function MejorasPage() {
  const [filtro, setFiltro] = useState('pendiente')
  const [newForm, setNewForm] = useState(false)
  const [newTitulo, setNewTitulo] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrio, setNewPrio] = useState('media')
  const qc = useQueryClient()

  const { data: mejoras = [], isLoading } = useQuery({
    queryKey: ['mejoras', filtro],
    queryFn: async () => {
      const res = await fetch(`/api/mejoras?estado=${filtro}`)
      return res.json()
    },
  })

  const patchMejora = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await fetch(`/api/mejoras/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mejoras'] }),
  })

  const deleteMejora = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/mejoras/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mejoras'] }),
  })

  const createMejora = useMutation({
    mutationFn: async () => {
      await fetch('/api/mejoras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: newTitulo, descripcion: newDesc, prioridad: newPrio }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mejoras'] })
      setNewForm(false)
      setNewTitulo('')
      setNewDesc('')
      setNewPrio('media')
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Mejoras"
        description="Ideas de nuevas funcionalidades guardadas desde el chat o manualmente"
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setNewForm((v) => !v)}>
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Button>
        }
      />

      {/* Formulario nueva mejora */}
      {newForm && (
        <SectionCard title="">
          <div className="space-y-3">
            <input
              value={newTitulo}
              onChange={(e) => setNewTitulo(e.target.value)}
              placeholder="Título de la mejora..."
              className="w-full text-sm bg-secondary rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 transition-colors"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descripción detallada — qué se quiere y por qué..."
              rows={3}
              className="w-full text-sm bg-secondary rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={newPrio}
                onChange={(e) => setNewPrio(e.target.value)}
                className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="alta">Alta prioridad</option>
                <option value="media">Media prioridad</option>
                <option value="baja">Baja prioridad</option>
              </select>
              <div className="flex gap-1.5 ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewForm(false)}>Cancelar</Button>
                <Button size="sm" className="h-7 text-xs" disabled={!newTitulo || !newDesc || createMejora.isPending} onClick={() => createMejora.mutate()}>Guardar</Button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Filtro tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        {ESTADOS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              filtro === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <SectionCard title="">
        {isLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-secondary animate-pulse" />)}</div>
        ) : mejoras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin mejoras</p>
            <p className="text-xs text-muted-foreground mt-1">Dile al chat qué quieres mejorar o añade una manualmente</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {mejoras.map((m: any) => (
              <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.descripcion}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border', PRIORIDAD_COLORS[m.prioridad] ?? PRIORIDAD_COLORS.media)}>
                        {m.prioridad}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border', ESTADO_COLORS[m.estado] ?? ESTADO_COLORS.pendiente)}>
                        {m.estado.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(m.createdAt), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-1 shrink-0">
                    {m.estado === 'pendiente' && (
                      <button
                        title="Marcar en revisión"
                        onClick={() => patchMejora.mutate({ id: m.id, data: { estado: 'en_revision' } })}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-purple-400 hover:border-purple-500/30 transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {m.estado !== 'implementada' && (
                      <button
                        title="Marcar implementada"
                        onClick={() => patchMejora.mutate({ id: m.id, data: { estado: 'implementada' } })}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-green-400 hover:border-green-500/30 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      title="Eliminar"
                      onClick={() => deleteMejora.mutate(m.id)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
