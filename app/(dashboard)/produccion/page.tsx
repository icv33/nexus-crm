'use client'

import { useQuery } from '@tanstack/react-query'
import { Hammer } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'

const ETAPAS = [
  { id: 'onboarding',    label: 'Onboarding',   color: 'bg-blue-500' },
  { id: 'requisitos',    label: 'Requisitos',    color: 'bg-purple-500' },
  { id: 'construccion',  label: 'Construcción',  color: 'bg-amber-500' },
  { id: 'revision',      label: 'Revisión',      color: 'bg-orange-500' },
  { id: 'entrega',       label: 'Entrega',       color: 'bg-green-500' },
  { id: 'mantenimiento', label: 'Mantenimiento', color: 'bg-teal-500' },
]

export default function ProduccionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['proyectos-produccion'],
    queryFn: async () => {
      const res = await fetch('/api/proyectos')
      return res.json()
    },
  })

  const proyectos = (data?.proyectos ?? []).filter((p: any) => p.estado === 'activo')

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Producción"
        description={`${proyectos.length} proyectos activos`}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            icon={Hammer}
            title="Sin proyectos en producción"
            description="Los proyectos activos aparecerán aquí organizados por etapa"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ETAPAS.map((etapa) => {
            const etapaProyectos = proyectos.filter((p: any) => p.etapa === etapa.id)
            return (
              <div key={etapa.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <div className={`w-2 h-2 rounded-full ${etapa.color}`} />
                  <span className="text-sm font-medium">{etapa.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">{etapaProyectos.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {etapaProyectos.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">Sin proyectos en esta etapa</p>
                  ) : (
                    etapaProyectos.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary border border-border">
                        <div>
                          <p className="text-xs font-medium">{p.nombre}</p>
                          <p className="text-[10px] text-muted-foreground">{p.servicioVendido?.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{p.progreso}%</span>
                          {p.bloqueos && <span className="text-[10px] text-red-400">⚠</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
