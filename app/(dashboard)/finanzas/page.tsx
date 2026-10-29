'use client'

import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Users, FileText, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { SectionCard } from '@/components/shared/SectionCard'

export default function FinanzasPage() {
  const { data: leadsData } = useQuery({
    queryKey: ['finanzas-leads'],
    queryFn: async () => {
      const res = await fetch('/api/leads?limit=200')
      return res.json()
    },
  })

  const { data: propuestasData } = useQuery({
    queryKey: ['finanzas-propuestas'],
    queryFn: async () => {
      const res = await fetch('/api/propuestas')
      return res.json()
    },
  })

  const { data: proyectosData } = useQuery({
    queryKey: ['finanzas-proyectos'],
    queryFn: async () => {
      const res = await fetch('/api/proyectos')
      return res.json()
    },
  })

  const leads = leadsData?.leads ?? []
  const propuestas = propuestasData?.propuestas ?? []
  const proyectos = proyectosData?.proyectos ?? []

  const pipeline = leads
    .filter((l: any) => !['perdido', 'descartado'].includes(l.estado))
    .reduce((s: number, l: any) => s + (l.valorEstimado ?? 0), 0)

  const negociacion = propuestas
    .filter((p: any) => ['enviada', 'pendiente_aprobacion'].includes(p.estado))
    .reduce((s: number, p: any) => s + (p.precioEstimado ?? 0), 0)

  const ingresosMes = proyectos
    .filter((p: any) => p.estado === 'activo')
    .reduce((s: number, p: any) => s + (p.valorTotal ?? 0), 0)

  const clientesActivos = proyectos.filter((p: any) => p.estado === 'activo').length

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Finanzas" description="Panel financiero de tu empresa" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Ingresos estimados" value={`€${ingresosMes.toLocaleString('es-ES')}`} icon={DollarSign} color="green" />
        <StatCard title="Valor del pipeline" value={`€${pipeline.toLocaleString('es-ES')}`} icon={TrendingUp} color="blue" />
        <StatCard title="En negociación" value={`€${negociacion.toLocaleString('es-ES')}`} icon={FileText} color="orange" />
        <StatCard title="Clientes activos" value={clientesActivos} icon={Users} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Proyectos activos" description="Ingresos confirmados">
          {proyectos.filter((p: any) => p.estado === 'activo').length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Sin proyectos activos</p>
          ) : (
            <div className="space-y-2">
              {proyectos.filter((p: any) => p.estado === 'activo').map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.servicioVendido?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-sm text-green-400 font-medium">
                    {p.valorTotal ? `€${p.valorTotal.toLocaleString('es-ES')}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Propuestas activas" description="Pendientes de cerrar">
          {propuestas.filter((p: any) => ['enviada', 'pendiente_aprobacion'].includes(p.estado)).length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Sin propuestas activas</p>
          ) : (
            <div className="space-y-2">
              {propuestas.filter((p: any) => ['enviada', 'pendiente_aprobacion'].includes(p.estado)).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm">{p.lead?.nombre ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{p.servicioOfrecido?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-sm text-amber-400 font-medium">
                    {p.precioEstimado ? `€${p.precioEstimado.toLocaleString('es-ES')}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
