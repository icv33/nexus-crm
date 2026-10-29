'use client'

import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const ETAPAS = ['onboarding', 'requisitos', 'construccion', 'revision', 'entrega', 'mantenimiento']

export function ProyectosClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['proyectos'],
    queryFn: async () => {
      const res = await fetch('/api/proyectos')
      return res.json()
    },
  })

  const proyectos = data?.proyectos ?? []

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Proyectos"
        description={`${data?.total ?? 0} proyectos`}
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> Nuevo proyecto
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            icon={FolderKanban}
            title="Sin proyectos activos"
            description="Los proyectos se crean cuando un lead pasa a estado ganado"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {proyectos.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{p.nombre}</p>
                    <StatusBadge status={p.estado} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.servicioVendido?.replace(/_/g, ' ')} · {p.lead?.nombre ?? 'Sin cliente'}
                  </p>
                </div>
                {p.valorTotal && (
                  <span className="text-xs text-green-400 font-medium">€{p.valorTotal.toLocaleString('es-ES')}</span>
                )}
              </div>

              {/* Pipeline etapas */}
              <div className="flex items-center gap-1 mb-3">
                {ETAPAS.map((etapa) => (
                  <div
                    key={etapa}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      ETAPAS.indexOf(etapa) <= ETAPAS.indexOf(p.etapa)
                        ? 'bg-primary'
                        : 'bg-secondary'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground capitalize">{p.etapa?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{p.progreso}% completado</span>
                </div>
                {p.bloqueos && (
                  <span className="text-xs text-red-400 flex items-center gap-1">⚠ Bloqueado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
