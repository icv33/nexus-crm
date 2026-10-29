'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Plus, AlertTriangle, Send, Trash2, X, Check,
  RefreshCw, ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

const SERVICIOS = [
  'diseño_web', 'tienda_online', 'seo', 'sem_ads', 'redes_sociales',
  'email_marketing', 'crm', 'automatizacion', 'consultoria', 'otros',
]

function NewPropuestaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<{ id: string; nombre: string } | null>(null)
  const [servicio, setServicio] = useState('diseño_web')
  const [precio, setPrecio] = useState('')
  const [plazo, setPlazo] = useState('')
  const [problema, setProblema] = useState('')
  const [solucion, setSolucion] = useState('')
  const [notas, setNotas] = useState('')

  const { data: leadsData } = useQuery({
    queryKey: ['leads-search', leadSearch],
    queryFn: async () => {
      const res = await fetch(`/api/leads?q=${encodeURIComponent(leadSearch)}&limit=10`)
      return res.json()
    },
    enabled: leadSearch.length >= 2,
  })
  const leads: any[] = leadsData?.leads ?? []

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/propuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead!.id,
          servicioOfrecido: servicio,
          precioEstimado: precio ? parseFloat(precio) : null,
          plazoEstimado: plazo || null,
          problemaDetectado: problema || null,
          solucionPropuesta: solucion || null,
          notas: notas || null,
        }),
      })
      if (!res.ok) throw new Error('Error al crear propuesta')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propuestas'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold">Nueva propuesta</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Lead selector */}
          <div>
            <p className="text-xs font-medium mb-1.5">Cliente *</p>
            {selectedLead ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-xs font-medium">{selectedLead.nombre}</span>
                <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  className="h-8 text-xs bg-secondary border-border"
                  placeholder="Buscar lead por nombre..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                {leads.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                    {leads.map((l: any) => (
                      <button
                        key={l.id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors"
                        onClick={() => { setSelectedLead({ id: l.id, nombre: l.nombre }); setLeadSearch('') }}
                      >
                        <span className="font-medium">{l.nombre}</span>
                        {l.sector && <span className="text-muted-foreground ml-2">{l.sector}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Servicio */}
          <div>
            <p className="text-xs font-medium mb-1.5">Servicio ofrecido *</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SERVICIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => setServicio(s)}
                  className={cn(
                    'text-xs px-3 py-2 rounded-lg border transition-colors text-left',
                    servicio === s
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Precio + plazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-1.5">Precio estimado (€)</p>
              <Input
                type="number"
                className="h-8 text-xs bg-secondary border-border"
                placeholder="ej. 2500"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Plazo estimado</p>
              <Input
                className="h-8 text-xs bg-secondary border-border"
                placeholder="ej. 4 semanas"
                value={plazo}
                onChange={(e) => setPlazo(e.target.value)}
              />
            </div>
          </div>

          {/* Problema */}
          <div>
            <p className="text-xs font-medium mb-1.5">Problema detectado</p>
            <Textarea
              className="text-xs bg-secondary border-border resize-none min-h-[60px]"
              placeholder="¿Qué problema tiene el cliente?"
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
            />
          </div>

          {/* Solución */}
          <div>
            <p className="text-xs font-medium mb-1.5">Solución propuesta</p>
            <Textarea
              className="text-xs bg-secondary border-border resize-none min-h-[60px]"
              placeholder="¿Qué vas a hacer para resolverlo?"
              value={solucion}
              onChange={(e) => setSolucion(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-medium mb-1.5">Notas adicionales</p>
            <Textarea
              className="text-xs bg-secondary border-border resize-none min-h-[50px]"
              placeholder="Condiciones especiales, descuentos..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="px-5 pb-2 text-xs text-destructive">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1 h-9 text-xs" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 h-9 text-xs gap-1.5"
            disabled={!selectedLead || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Crear propuesta
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PropuestasClient() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['propuestas'],
    queryFn: async () => {
      const res = await fetch('/api/propuestas')
      return res.json()
    },
  })

  const propuestas = data?.propuestas ?? []
  const pendientes = propuestas.filter((p: any) => p.estado === 'pendiente_aprobacion')

  const sendEmail = async (id: string) => {
    setSending(id)
    try {
      const res = await fetch(`/api/propuestas/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? 'Error al enviar')
      } else {
        qc.invalidateQueries({ queryKey: ['propuestas'] })
      }
    } finally {
      setSending(null)
    }
  }

  const deletePropuesta = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta?')) return
    setDeleting(id)
    try {
      await fetch(`/api/propuestas/${id}`, { method: 'DELETE' })
      qc.invalidateQueries({ queryKey: ['propuestas'] })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Propuestas"
        description={`${data?.total ?? 0} propuestas en total`}
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" /> Nueva propuesta
          </Button>
        }
      />

      {pendientes.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-400">
            {pendientes.length} {pendientes.length === 1 ? 'propuesta pendiente' : 'propuestas pendientes'} de aprobación
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}
          </div>
        ) : propuestas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin propuestas todavía"
            description="Crea tu primera propuesta con el botón de arriba"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Servicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Precio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {propuestas.map((p: any) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${p.leadId}`} className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
                      {p.lead?.nombre ?? '—'}
                      <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </Link>
                    {p.lead?.email && (
                      <p className="text-[10px] text-muted-foreground">{p.lead.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.servicioOfrecido?.replace(/_/g, ' ') ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.estado} /></td>
                  <td className="px-4 py-3 text-xs text-green-400 font-medium">
                    {p.precioEstimado ? `€${p.precioEstimado.toLocaleString('es-ES')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(p.createdAt), 'dd MMM yyyy', { locale: es })}
                    {p.fechaEnvio && (
                      <p className="text-[10px] text-emerald-400">
                        Enviada {format(new Date(p.fechaEnvio), 'dd MMM', { locale: es })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.estado !== 'enviada' && p.lead?.email && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                          disabled={sending === p.id}
                          onClick={() => sendEmail(p.id)}
                        >
                          {sending === p.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />}
                          Enviar
                        </Button>
                      )}
                      <button
                        onClick={() => deletePropuesta(p.id)}
                        disabled={deleting === p.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-destructive/20 text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        {deleting === p.id
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewPropuestaModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
