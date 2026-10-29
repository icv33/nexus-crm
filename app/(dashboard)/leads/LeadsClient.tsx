'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Users, ExternalLink, Mail, SendHorizonal, RefreshCw, CheckCircle2, AlertCircle, Globe, X, AlertTriangle, Phone, Download } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NewLeadModal } from './NewLeadModal'
import { cn } from '@/lib/utils'

const ESTADOS_FILTER = [
  { value: 'contactado',        label: 'Contactado',  color: 'blue' },
  { value: 'seguimiento_1',     label: 'Seg. 1',      color: 'sky' },
  { value: 'seguimiento_2',     label: 'Seg. 2',      color: 'yellow' },
  { value: 'seguimiento_3',     label: 'Seg. 3',      color: 'orange' },
  { value: 'respondio',         label: 'Respondió',   color: 'purple' },
  { value: 'interesado',        label: 'Interesado',  color: 'green' },
  { value: 'reunion_agendada',  label: 'Reunión',     color: 'teal' },
  { value: 'propuesta_enviada', label: 'Propuesta',   color: 'indigo' },
  { value: 'negociacion',       label: 'Negociando',  color: 'amber' },
  { value: 'ganado',            label: 'Ganado',      color: 'emerald' },
  { value: 'perdido',           label: 'Perdido',     color: 'red' },
  { value: 'descartado',        label: 'Descartado',  color: 'zinc' },
]

const COLOR_MAP: Record<string, string> = {
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  sky:     'bg-sky-500/10 text-sky-400 border-sky-500/30',
  yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  orange:  'bg-orange-500/10 text-orange-400 border-orange-500/30',
  purple:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  green:   'bg-green-500/10 text-green-400 border-green-500/30',
  teal:    'bg-teal-500/10 text-teal-400 border-teal-500/30',
  indigo:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  red:     'bg-red-500/10 text-red-400 border-red-500/30',
  zinc:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
}

export function LeadsClient() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [estados, setEstados] = useState<Set<string>>(() => {
    const e = searchParams.get('estado')
    return e ? new Set(e.split(',')) : new Set()
  })
  const [prioridades, setPrioridades] = useState<Set<string>>(() => {
    const p = searchParams.get('prioridad')
    return p ? new Set([p]) : new Set()
  })
  const [sector, setSector] = useState('')
  const [tieneEmail, setTieneEmail] = useState(() => searchParams.get('tieneEmail') ?? 'todos')
  const [showModal, setShowModal] = useState(false)
  const [contactarResult, setContactarResult] = useState<any | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const e = searchParams.get('estado')
    if (e) setEstados(new Set(e.split(',')))
    const te = searchParams.get('tieneEmail')
    if (te) setTieneEmail(te)
    const p = searchParams.get('prioridad')
    if (p) setPrioridades(new Set([p]))
  }, [searchParams])

  function toggleEstado(e: string) {
    setEstados(prev => { const n = new Set(prev); n.has(e) ? n.delete(e) : n.add(e); return n })
  }
  function togglePrioridad(p: string) {
    setPrioridades(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })
  }

  const hasFilters = estados.size > 0 || prioridades.size > 0 || sector !== '' || tieneEmail !== 'todos'

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, [...estados].sort().join(','), [...prioridades].sort().join(','), sector, tieneEmail],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (estados.size > 0) params.set('estado', [...estados].join(','))
      if (prioridades.size > 0) params.set('prioridad', [...prioridades].join(','))
      if (sector) params.set('sector', sector)
      if (tieneEmail !== 'todos') params.set('tieneEmail', tieneEmail)
      const res = await fetch(`/api/leads?${params}`)
      return res.json()
    },
  })

  const contactarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/leads/contactar-masa', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error al enviar emails')
      return d
    },
    onSuccess: (d) => { setContactarResult(d); qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  const enriquecerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/leads/enriquecer', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      return d
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })

  const leads = data?.leads ?? []
  const totalLeads = data?.total ?? 0

  function buildExportUrl() {
    const params = new URLSearchParams()
    if (estados.size > 0) params.set('estado', [...estados].join(','))
    if (prioridades.size > 0) params.set('prioridad', [...prioridades].join(','))
    if (sector) params.set('sector', sector)
    return `/api/leads/export?${params}`
  }

  const { data: alertData } = useQuery({
    queryKey: ['leads-alerta-prioridad'],
    queryFn: async () => { const res = await fetch('/api/leads?prioridad=alta&tieneEmail=no&limit=5'); return res.json() },
  })
  const altaSinEmail: any[] = alertData?.leads ?? []

  function clearFilters() { setEstados(new Set()); setPrioridades(new Set()); setSector(''); setTieneEmail('todos') }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Leads"
        description={`${totalLeads} leads`}
        actions={
          <div className="flex items-center gap-2">
            <a href={buildExportUrl()} download className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" disabled={enriquecerMutation.isPending} onClick={() => enriquecerMutation.mutate()} title="Visita las webs y extrae emails">
              {enriquecerMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Extrayendo...</> : <><Globe className="w-3.5 h-3.5" /> Extraer emails</>}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" disabled={contactarMutation.isPending} onClick={() => { setContactarResult(null); contactarMutation.mutate() }}>
              {contactarMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...</> : <><SendHorizonal className="w-3.5 h-3.5" /> Contactar leads</>}
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Nuevo lead
            </Button>
          </div>
        }
      />

      {altaSinEmail.length > 0 && tieneEmail !== 'no' && !prioridades.has('alta') && (
        <div className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-400 flex-1">
            <span className="font-medium">{alertData?.total ?? altaSinEmail.length} leads de alta prioridad</span> sin email — necesitan revisión manual.
          </p>
          <button onClick={() => { setPrioridades(new Set(['alta'])); setTieneEmail('no') }} className="text-red-400 hover:text-red-300 font-medium whitespace-nowrap transition-colors">
            Ver ahora →
          </button>
        </div>
      )}

      {enriquecerMutation.isSuccess && enriquecerMutation.data && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span className="font-medium text-blue-400">{enriquecerMutation.data.encontrados} emails encontrados de {enriquecerMutation.data.procesados} webs</span>
        </div>
      )}
      {contactarMutation.isError && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{(contactarMutation.error as Error).message}</span>
        </div>
      )}
      {contactarResult && (
        <div className="p-3 mb-4 rounded-lg bg-green-500/5 border border-green-500/15 text-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="font-medium text-green-400">{contactarResult.enviados} emails enviados</span>
          </div>
          {contactarResult.nombres?.length > 0 && (
            <div className="flex flex-wrap gap-1">{contactarResult.nombres.map((n: string) => <span key={n} className="bg-secondary border border-border px-2 py-0.5 rounded-full text-[10px]">{n}</span>)}</div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3 mb-5">
        {/* Búsqueda + sector + email toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar nombre, email, ciudad..." className="pl-8 h-8 text-xs bg-secondary border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Input placeholder="Sector..." className="w-36 h-8 text-xs bg-secondary border-border" value={sector} onChange={(e) => setSector(e.target.value)} />
          <button
            onClick={() => setTieneEmail(tieneEmail === 'si' ? 'todos' : tieneEmail === 'no' ? 'si' : 'no')}
            className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', tieneEmail === 'si' ? 'bg-green-500/10 text-green-400 border-green-500/30' : tieneEmail === 'no' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'text-muted-foreground border-border hover:text-foreground')}
          >
            {tieneEmail === 'si' ? '✓ Con email' : tieneEmail === 'no' ? '✗ Sin email' : 'Email: todos'}
          </button>
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3" /> Limpiar
            </Button>
          )}
        </div>

        {/* Pills de estado */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Estado:</span>
          {ESTADOS_FILTER.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => toggleEstado(value)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                estados.has(value) ? COLOR_MAP[color] : 'text-muted-foreground border-border hover:border-border/80 hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pills de prioridad */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Prioridad:</span>
          {(['alta', 'media', 'baja'] as const).map((p) => (
            <button
              key={p}
              onClick={() => togglePrioridad(p)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full border capitalize transition-colors',
                prioridades.has(p)
                  ? p === 'alta' ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : p === 'media' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                  : 'text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}</div>
        ) : leads.length === 0 ? (
          <EmptyState icon={Users} title="Sin resultados" description="No hay leads que coincidan con los filtros aplicados" action={<Button size="sm" onClick={clearFilters} variant="outline" className="text-xs">Limpiar filtros</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Negocio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sector</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Puntuación</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Creado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any) => (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors group">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{lead.nombre}</p>
                      {lead.ciudad && <p className="text-xs text-muted-foreground">{lead.ciudad}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{lead.sector ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.estado} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={lead.prioridad} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full max-w-[60px]">
                        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${(lead.puntuacion ?? 0) * 10}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{lead.puntuacion ?? 0}/10</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {lead.semaforo === 'rojo' ? (
                        <span title="Semáforo rojo — requiere revisión" className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/15 border border-red-500/30 text-red-400">
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </span>
                      ) : (!lead.email && !lead.telefono) ? (
                        <span title="Sin email ni teléfono" className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </span>
                      ) : null}
                      <span title={lead.email ?? 'Sin email'} className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border', lead.email ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-secondary text-muted-foreground border-border')}>
                        <Mail className="w-2.5 h-2.5" />{lead.email ? 'Email' : '—'}
                      </span>
                      <span title={lead.telefono ?? 'Sin teléfono'} className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border', lead.telefono ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-secondary text-muted-foreground border-border')}>
                        <Phone className="w-2.5 h-2.5" />{lead.telefono ?? '—'}
                      </span>
                      <span title={lead.web ?? 'Sin web'} className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border', lead.web ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-secondary text-muted-foreground border-border')}>
                        <Globe className="w-2.5 h-2.5" />{lead.web ? 'Web' : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(lead.createdAt), 'dd MMM', { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.web && (
                        <a href={lead.web} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link href={`/leads/${lead.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewLeadModal onClose={() => setShowModal(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['leads'] })} />
      )}
    </div>
  )
}
