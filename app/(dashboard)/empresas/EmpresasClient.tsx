'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Globe, Mail, Phone } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'

export function EmpresasClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const res = await fetch('/api/empresas')
      return res.json()
    },
  })

  const empresas = data?.empresas ?? []

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Empresas"
        description={`${data?.total ?? 0} empresas registradas`}
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> Nueva empresa
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : empresas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            icon={Building2}
            title="Sin empresas registradas"
            description="Las empresas aparecerán aquí cuando conviertas leads en clientes"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((e: any) => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{e.nombre}</p>
                    <p className="text-xs text-muted-foreground">{e.sector ?? '—'}</p>
                  </div>
                </div>
                {e.valorEstimado && (
                  <span className="text-xs text-green-400 font-medium">€{e.valorEstimado.toLocaleString('es-ES')}</span>
                )}
              </div>
              <div className="space-y-1.5">
                {e.ciudad && <p className="text-xs text-muted-foreground">📍 {e.ciudad}</p>}
                {e.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">{e.email}</span>
                  </div>
                )}
                {e.web && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <a href={e.web} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">Ver web</a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
