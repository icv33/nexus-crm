'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Megaphone, Play, Pause, Users, Send, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CampanasClient() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nombre: '', ciudadObjetivo: 'Zaragoza', sectorObjetivo: '', limiteDiarioEmails: 5,
  })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['campanas'],
    queryFn: async () => {
      const res = await fetch('/api/campanas')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/campanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanas'] }); setShowForm(false) },
  })

  const campanas = data?.campanas ?? []

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Campañas"
        description="Gestiona tus campañas de captación de leads"
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> Nueva campaña
          </Button>
        }
      />

      {/* Form inline */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <h3 className="text-sm font-medium mb-4">Nueva campaña</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Nombre de la campaña</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="Campaña restaurantes Zaragoza" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ciudad objetivo</Label>
              <Input className="h-8 text-sm bg-secondary border-border" value={form.ciudadObjetivo} onChange={(e) => setForm((f) => ({ ...f, ciudadObjetivo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sector objetivo</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="Restauración, Retail..." value={form.sectorObjetivo} onChange={(e) => setForm((f) => ({ ...f, sectorObjetivo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Límite diario de emails</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" min={1} max={50} value={form.limiteDiarioEmails} onChange={(e) => setForm((f) => ({ ...f, limiteDiarioEmails: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" className="text-xs" disabled={!form.nombre || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? 'Creando...' : 'Crear campaña'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : campanas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            icon={Megaphone}
            title="Sin campañas activas"
            description="Crea tu primera campaña para organizar tu proceso de captación"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {campanas.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{c.nombre}</p>
                    <StatusBadge status={c.estado} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.ciudadObjetivo} · {c.sectorObjetivo || 'Todos los sectores'} · Límite: {c.limiteDiarioEmails} emails/día
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.estado === 'activa' ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <Pause className="w-3 h-3" /> Pausar
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-400">
                      <Play className="w-3 h-3" /> Activar
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border">
                <Metric icon={Users} label="Leads" value={c.leadsGenerados} />
                <Metric icon={Send} label="Enviados" value={c.emailsEnviados} />
                <Metric icon={MessageSquare} label="Respuestas" value={c.respuestasRecibidas} />
                {c.emailsEnviados > 0 && (
                  <Metric icon={MessageSquare} label="Tasa resp." value={`${Math.round((c.respuestasRecibidas / c.emailsEnviados) * 100)}%`} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  )
}
