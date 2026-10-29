'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain, TrendingUp, MessageSquare, BarChart3, Lightbulb,
  Play, RefreshCw, CheckCircle2, XCircle, Circle, ChevronRight,
  MapPin, Globe, Mail, Search, Copy, Check, Sparkles, X,
  Power, PowerOff, FileText, ClipboardList, Hammer, Target,
  Zap, AlertTriangle, ArrowUpRight, Clock, Building2,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/shared/SectionCard'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RelTime({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-zinc-600">Nunca</span>
  return (
    <span className="text-muted-foreground" title={format(new Date(iso), 'dd/MM HH:mm', { locale: es })}>
      hace {formatDistanceToNow(new Date(iso), { locale: es })}
    </span>
  )
}

function AgentTimer({ listo, minutos, label }: { listo: boolean; minutos: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Circle className={`w-1.5 h-1.5 ${listo ? 'fill-green-400 text-green-400' : 'fill-zinc-600 text-zinc-600'}`} />
      <span className="text-muted-foreground">{label}</span>
      {listo
        ? <span className="text-green-400">listo</span>
        : <span className="text-muted-foreground">{minutos > 90 ? `${Math.ceil(minutos / 60)}h` : `${Math.ceil(minutos)}min`}</span>}
    </div>
  )
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type TabId = 'comercial' | 'creatividad' | 'produccion' | 'analisis'

const TABS: { id: TabId; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'comercial', label: 'Comercial', icon: <TrendingUp className="w-3.5 h-3.5" />, desc: 'Prospección · Comunicación · Seguimiento' },
  { id: 'creatividad', label: 'Creatividad', icon: <Lightbulb className="w-3.5 h-3.5" />, desc: 'Ideas · Oportunidades · Copywriting' },
  { id: 'produccion', label: 'Producción', icon: <Hammer className="w-3.5 h-3.5" />, desc: 'Propuestas · Requisitos · Proyectos' },
  { id: 'analisis', label: 'Análisis', icon: <BarChart3 className="w-3.5 h-3.5" />, desc: 'Insights · Resumen diario' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentesClient() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('comercial')
  const [cerebroResult, setCerebroResult] = useState<any>(null)

  const { data: cerebroData, refetch: refetchCerebro } = useQuery({
    queryKey: ['cerebro'],
    queryFn: async () => {
      const res = await fetch('/api/cerebro/run')
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const cerebroToggle = useMutation({
    mutationFn: async (habilitado: boolean) => {
      const res = await fetch('/api/cerebro/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setHabilitado: habilitado }),
      })
      return res.json()
    },
    onSuccess: () => refetchCerebro(),
  })

  const cerebroConfig = useMutation({
    mutationFn: async (cfg: { setSector?: string; setCiudad?: string }) => {
      const res = await fetch('/api/cerebro/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, configOnly: true }),
      })
      return res.json()
    },
    onSuccess: () => refetchCerebro(),
  })

  const cerebroRun = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await fetch('/api/cerebro/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (!data.skipped) setCerebroResult(data)
      refetchCerebro()
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  // Auto-run al cargar (el intervalo de 30min lo gestiona CerebroAutoRun en el layout)
  useEffect(() => {
    if (cerebroData?.habilitado) cerebroRun.mutate(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerebroData?.habilitado])

  const { data: metricasData } = useQuery({
    queryKey: ['metricas-agentes'],
    queryFn: async () => {
      const res = await fetch('/api/metricas')
      return res.json()
    },
    staleTime: 120_000,
  })

  const habilitado = cerebroData?.habilitado ?? false
  const ag = cerebroData?.agentes
  const [sectorInput, setSectorInput] = useState('')
  const [ciudadInput, setCiudadInput] = useState('')

  const sem = metricasData?.semaforo
  const riesgo = metricasData?.riesgo
  const funnel = metricasData?.funnel

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Agentes IA"
        description="Tu empresa virtual — CEO · Comercial · Creatividad · Producción · Análisis"
      />

      {/* ── CEO / Cerebro Central ─────────────────────────────────────────────── */}
      <div className={`rounded-xl border-2 p-5 transition-all ${habilitado ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${habilitado ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary text-muted-foreground'}`}>
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">Cerebro Central</p>
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">CEO</span>
              </div>
              <p className="text-xs mt-0.5">
                {habilitado
                  ? <span className="text-green-400 flex items-center gap-1"><Circle className="w-1.5 h-1.5 fill-green-400" /> Activo — ejecuta agentes automáticamente</span>
                  : <span className="text-zinc-500">Desactivado — los agentes no corren solos</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              disabled={cerebroRun.isPending}
              onClick={() => cerebroRun.mutate(true)}
            >
              {cerebroRun.isPending
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ejecutando...</>
                : <><Play className="w-3.5 h-3.5" /> Ejecutar ahora</>}
            </Button>
            <Button
              size="sm"
              className={`h-8 text-xs gap-1.5 ${habilitado ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20' : 'bg-primary'}`}
              disabled={cerebroToggle.isPending}
              onClick={() => cerebroToggle.mutate(!habilitado)}
            >
              {habilitado ? <><PowerOff className="w-3.5 h-3.5" /> Pausar</> : <><Power className="w-3.5 h-3.5" /> Activar</>}
            </Button>
          </div>
        </div>

        {/* Config row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Sector</Label>
            <Input
              className="h-6 text-xs bg-background border-border w-32"
              defaultValue={cerebroData?.sector ?? 'Restaurantes'}
              key={cerebroData?.sector}
              onChange={(e) => setSectorInput(e.target.value)}
              onBlur={() => sectorInput && cerebroConfig.mutate({ setSector: sectorInput })}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Ciudad</Label>
            <Input
              className="h-6 text-xs bg-background border-border w-28"
              defaultValue={cerebroData?.ciudad ?? 'Zaragoza'}
              key={cerebroData?.ciudad}
              onChange={(e) => setCiudadInput(e.target.value)}
              onBlur={() => ciudadInput && cerebroConfig.mutate({ setCiudad: ciudadInput })}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            Última ejecución: <RelTime iso={cerebroData?.ultimaEjecucion ?? null} />
          </span>
        </div>

        {/* Agent timers */}
        {ag && (
          <div className="flex flex-wrap gap-4 mb-3">
            <AgentTimer listo={ag.negociador?.listo} minutos={ag.negociador?.minutosParaProxima} label="Negociador (30min)" />
            <AgentTimer listo={ag.pipeline?.listo} minutos={ag.pipeline?.minutosParaProxima} label="Pipeline (6h)" />
            <AgentTimer listo={ag.seguimiento?.listo} minutos={ag.seguimiento?.minutosParaProxima} label="Seguimiento (24h)" />
            <AgentTimer listo={ag.resumen?.listo} minutos={ag.resumen?.minutosParaProxima} label="Resumen (20h)" />
          </div>
        )}

        {/* Last run results */}
        {(() => {
          const r = cerebroResult ?? cerebroData?.ultimoResultado
          if (!r?.acciones?.length) return null
          return (
            <div className="p-3 rounded-lg bg-background border border-border space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Última ejecución — {r.sector} · {r.ciudad}
              </p>
              {r.acciones.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {a.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                  <span className="font-medium w-24 shrink-0 text-[11px]">{a.agente}</span>
                  <span className="text-muted-foreground text-[11px]">{a.resultado}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ── Panel de riesgo comercial ─────────────────────────────────────────── */}
      {(sem || riesgo) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sem && (
            <>
              <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{sem.verde}</p>
                  <p className="text-[10px] text-muted-foreground">Verde — OK</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{sem.amarillo}</p>
                  <p className="text-[10px] text-muted-foreground">Amarillo — Revisar</p>
                </div>
              </div>
            </>
          )}
          {riesgo && (
            <>
              <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{sem?.rojo ?? 0} · {riesgo.alto} alto</p>
                  <p className="text-[10px] text-muted-foreground">Rojo / Riesgo alto</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs font-semibold">{funnel?.find((f: any) => f.etapa === 'Ganados')?.count ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">Ganados · {funnel?.find((f: any) => f.etapa === 'Ganados')?.porcentaje ?? 0}% conversión</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab navigation ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────────── */}
      {activeTab === 'comercial' && <ComercialTab />}
      {activeTab === 'creatividad' && <CreatividadTab />}
      {activeTab === 'produccion' && <ProduccionTab />}
      {activeTab === 'analisis' && <AnalisisTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMERCIAL TAB
// ─────────────────────────────────────────────────────────────────────────────

function ComercialTab() {
  const qc = useQueryClient()
  const [sector, setSector] = useState('Restaurantes')
  const [ciudad, setCiudad] = useState('Zaragoza')
  const [max, setMax] = useState('20')
  const [pipelineResult, setPipelineResult] = useState<any>(null)
  const [negociadorResult, setNegociadorResult] = useState<any>(null)
  const [seguimientoResult, setSeguimientoResult] = useState<any>(null)
  const [agendaResult, setAgendaResult] = useState<any>(null)
  const [emailIdea, setEmailIdea] = useState('')
  const [emailNegocio, setEmailNegocio] = useState('')
  const [emailGenerado, setEmailGenerado] = useState('')
  const [copied, setCopied] = useState(false)

  const pipelineMut = useMutation({
    mutationFn: async (soloProspeccion: boolean) => {
      const url = soloProspeccion ? '/api/agentes/prospeccion' : '/api/pipeline/run'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector, ciudad, maxResultados: parseInt(max) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return { data, soloProspeccion }
    },
    onSuccess: ({ data, soloProspeccion }) => {
      setPipelineResult(soloProspeccion ? { paso1_leads: data.creados, paso1_omitidos: data.omitidos, paso3_enviados: 0, ok: true } : data)
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const negociadorMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/negociador', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => { setNegociadorResult(data); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const seguimientoMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/seguimiento-auto', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => { setSeguimientoResult(data); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const agendaMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanTareas: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => { setAgendaResult(data); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const emailMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/email-personalizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: emailIdea, negocio: emailNegocio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setEmailGenerado(data.email),
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Pipeline completo */}
      <SectionCard title="Pipeline Automático" description="Google Maps → extraer emails → enviar contactos">
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Sector</Label>
              <Input className="h-7 text-xs bg-secondary mt-1" value={sector} onChange={(e) => setSector(e.target.value)} /></div>
            <div><Label className="text-[10px]">Ciudad</Label>
              <Input className="h-7 text-xs bg-secondary mt-1" value={ciudad} onChange={(e) => setCiudad(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3 text-primary" /> Maps <ChevronRight className="w-2.5 h-2.5" />
            <Globe className="w-3 h-3 text-blue-400" /> Emails <ChevronRight className="w-2.5 h-2.5" />
            <Mail className="w-3 h-3 text-green-400" /> Envío
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 h-8 text-xs gap-1" disabled={pipelineMut.isPending} onClick={() => { setPipelineResult(null); pipelineMut.mutate(false) }}>
              {pipelineMut.isPending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Ejecutando...</> : <><Play className="w-3 h-3" /> Pipeline completo</>}
            </Button>
            <Button variant="outline" className="h-8 text-xs gap-1 px-2" disabled={pipelineMut.isPending} onClick={() => { setPipelineResult(null); pipelineMut.mutate(true) }}>
              <Search className="w-3 h-3" /> Solo buscar
            </Button>
          </div>
          {pipelineMut.isError && <p className="text-xs text-destructive">{(pipelineMut.error as Error).message}</p>}
          {pipelineResult && (
            <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/15 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {pipelineResult.paso1_leads} leads · {pipelineResult.paso3_enviados ?? 0} enviados
              </div>
              {pipelineResult.varianteUsada && <p className="text-[10px] text-muted-foreground">&ldquo;{pipelineResult.varianteUsada} en {ciudad}&rdquo; · {pipelineResult.paso1_omitidos} ya existían</p>}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Negociador */}
      <SectionCard title="Negociador" description="Revisa Gmail · responde automáticamente · detecta rebotes">
        <div className="space-y-2.5">
          <Button className="w-full h-8 text-xs gap-1.5" variant="outline" disabled={negociadorMut.isPending} onClick={() => { setNegociadorResult(null); negociadorMut.mutate() }}>
            {negociadorMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Revisando inbox...</> : <><MessageSquare className="w-3.5 h-3.5" /> Revisar y responder</>}
          </Button>
          {negociadorMut.isError && <p className="text-xs text-destructive">{(negociadorMut.error as Error).message}</p>}
          {negociadorResult && (
            <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {negociadorResult.respondidos} respondidos · {negociadorResult.delegados} delegados
                {negociadorResult.rebotes > 0 && <span className="text-amber-400"> · {negociadorResult.rebotes} inválidos</span>}
              </div>
              {negociadorResult.detalles?.slice(0, 3).map((d: string, i: number) => (
                <p key={i} className="text-[10px] text-muted-foreground">{d}</p>
              ))}
              {negociadorResult.procesados === 0 && <p className="text-muted-foreground">Bandeja al día.</p>}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Seguimiento automático */}
      <SectionCard title="Seguimiento Automático" description="Recontacta leads sin respuesta tras 3 días · máx 3 emails por lead">
        <div className="space-y-2.5">
          <div className="p-2 rounded bg-secondary text-[10px] text-muted-foreground space-y-0.5">
            <p>• Busca leads en estado <span className="text-foreground">contactado</span> sin respuesta</p>
            <p>• Genera email personalizado según el historial</p>
            <p>• Envía máx 3 emails en total por lead</p>
          </div>
          <Button className="w-full h-8 text-xs gap-1.5" variant="outline" disabled={seguimientoMut.isPending} onClick={() => { setSeguimientoResult(null); seguimientoMut.mutate() }}>
            {seguimientoMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando seguimientos...</> : <><Zap className="w-3.5 h-3.5" /> Enviar seguimientos</>}
          </Button>
          {seguimientoMut.isError && <p className="text-xs text-destructive">{(seguimientoMut.error as Error).message}</p>}
          {seguimientoResult && (
            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {seguimientoResult.enviados?.length ?? 0} seguimientos · {seguimientoResult.omitidos?.length ?? 0} omitidos
              </div>
              {seguimientoResult.enviados?.map((n: string, i: number) => <p key={i} className="text-[10px] text-muted-foreground">→ {n}</p>)}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Agenda automática */}
      <SectionCard title="Agente Agenda" description="Detecta intención de reunión · agenda en Google Calendar · crea evento">
        <div className="space-y-2.5">
          <div className="p-2 rounded bg-secondary text-[10px] text-muted-foreground space-y-0.5">
            <p>• Busca tareas de tipo <span className="text-foreground">reunión pendiente</span></p>
            <p>• Comprueba disponibilidad en Google Calendar</p>
            <p>• Crea evento con Google Meet automáticamente</p>
          </div>
          <Button className="w-full h-8 text-xs gap-1.5" variant="outline" disabled={agendaMut.isPending} onClick={() => { setAgendaResult(null); agendaMut.mutate() }}>
            {agendaMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Agendando...</> : <><Clock className="w-3.5 h-3.5" /> Agendar reuniones pendientes</>}
          </Button>
          {agendaMut.isError && <p className="text-xs text-destructive">{(agendaMut.error as Error).message}</p>}
          {agendaResult && (
            <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {agendaResult.agendadas?.length ?? 0} agendadas · {agendaResult.errores?.length ?? 0} errores
              </div>
              {agendaResult.agendadas?.map((n: string, i: number) => <p key={i} className="text-[10px] text-muted-foreground">→ {n}</p>)}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Email personalizado */}
      <SectionCard title="Email Personalizado" description="Tu idea → email al tono Nexus Digital">
        <div className="space-y-2">
          <Input className="h-7 text-xs bg-secondary" placeholder="Nombre del negocio (opcional)" value={emailNegocio} onChange={(e) => setEmailNegocio(e.target.value)} />
          <Textarea className="text-xs bg-secondary resize-none min-h-[70px]" placeholder="Tu idea o borrador..." value={emailIdea} onChange={(e) => setEmailIdea(e.target.value)} />
          <Button className="w-full h-8 text-xs gap-1.5" disabled={emailMut.isPending || !emailIdea.trim()} onClick={() => { setEmailGenerado(''); emailMut.mutate() }}>
            {emailMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><Mail className="w-3.5 h-3.5" /> Generar email</>}
          </Button>
          {emailGenerado && (
            <div className="relative p-2.5 rounded-lg bg-secondary border border-border text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap font-sans pr-6">{emailGenerado}</pre>
              <button className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(emailGenerado); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVIDAD TAB
// ─────────────────────────────────────────────────────────────────────────────

function CreatividadTab() {
  const [creativoSector, setCreativoSector] = useState('')
  const [creativoResult, setCreativoResult] = useState<any>(null)
  const [oportunidadesResult, setOportunidadesResult] = useState<any>(null)
  const [copyTipo, setCopyTipo] = useState('instagram')
  const [copyNegocio, setCopyNegocio] = useState('')
  const [copySector, setCopySector] = useState('')
  const [copyDetalles, setCopyDetalles] = useState('')
  const [copyResult, setCopyResult] = useState<any>(null)
  const [copyCopied, setCopyCopied] = useState(false)

  const creativoMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/creativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector: creativoSector }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setCreativoResult(data),
  })

  const oportunidadesMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/oportunidades', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setOportunidadesResult(data),
  })

  const copyMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/copywriting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: copyTipo, negocio: copyNegocio, sector: copySector, detalles: copyDetalles }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setCopyResult(data),
  })

  const URGENCIA_COLOR: Record<string, string> = {
    alta: 'text-red-400 bg-red-500/10 border-red-500/20',
    media: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    baja: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  }

  const COPY_TIPOS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'landing_page', label: 'Landing Page' },
    { value: 'email_campana', label: 'Email Campaña' },
    { value: 'slogan', label: 'Slogans' },
    { value: 'pitch', label: 'Pitch Ventas' },
    { value: 'guion_video', label: 'Guión Vídeo' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agente Creativo */}
        <SectionCard title="Agente Creativo" description="Genera ideas únicas de servicios para cualquier sector de negocio">
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs bg-secondary flex-1"
                placeholder="Ej: Restaurantes, Clínicas dentales, Peluquerías..."
                value={creativoSector}
                onChange={(e) => setCreativoSector(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && creativoSector.trim() && creativoMut.mutate()}
              />
              <Button className="h-8 text-xs gap-1.5 shrink-0" disabled={creativoMut.isPending || !creativoSector.trim()} onClick={() => { setCreativoResult(null); creativoMut.mutate() }}>
                {creativoMut.isPending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Pensando...</> : <><Lightbulb className="w-3 h-3" /> Generar ideas</>}
              </Button>
            </div>
            {creativoMut.isError && <p className="text-xs text-destructive">{(creativoMut.error as Error).message}</p>}
            {creativoResult?.ideas && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {creativoResult.ideas.map((idea: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary border border-border space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{idea.nombre}</p>
                      <div className="flex gap-1 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${URGENCIA_COLOR[idea.urgencia] ?? URGENCIA_COLOR.media}`}>{idea.urgencia}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{idea.precio_orientativo}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{idea.descripcion}</p>
                    <p className="text-[10px] text-primary italic">&ldquo;{idea.pitch}&rdquo;</p>
                    <p className="text-[10px] text-green-400">✓ {idea.porque_funciona}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Oportunidades */}
        <SectionCard title="Detector de Oportunidades" description="Analiza tu CRM con IA y encuentra dónde está el dinero">
          <div className="space-y-2.5">
            <Button className="w-full h-8 text-xs gap-1.5" disabled={oportunidadesMut.isPending} onClick={() => { setOportunidadesResult(null); oportunidadesMut.mutate() }}>
              {oportunidadesMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analizando CRM...</> : <><Target className="w-3.5 h-3.5" /> Encontrar oportunidades</>}
            </Button>
            {oportunidadesMut.isError && <p className="text-xs text-destructive">{(oportunidadesMut.error as Error).message}</p>}
            {oportunidadesResult && (
              <div className="space-y-2">
                {oportunidadesResult.resumen_mercado && (
                  <p className="text-xs text-muted-foreground p-2 bg-secondary rounded">{oportunidadesResult.resumen_mercado}</p>
                )}
                {oportunidadesResult.oportunidades?.map((op: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border space-y-1 ${op.impacto === 'alto' ? 'bg-primary/5 border-primary/20' : 'bg-secondary border-border'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{op.titulo}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${op.impacto === 'alto' ? 'text-primary bg-primary/10 border-primary/20' : 'text-muted-foreground border-border'}`}>{op.tipo}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{op.descripcion}</p>
                    <p className="text-[10px] text-green-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {op.accion_inmediata}</p>
                  </div>
                ))}
                {oportunidadesResult.datos && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {oportunidadesResult.datos.conversionRates?.slice(0, 3).map((s: any) => (
                      <div key={s.sector} className="p-1.5 bg-secondary rounded text-center">
                        <p className="text-[9px] text-muted-foreground truncate">{s.sector}</p>
                        <p className="text-xs font-bold text-primary">{s.tasa}%</p>
                        <p className="text-[9px] text-muted-foreground">{s.total} leads</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Copywriting */}
      <SectionCard title="Agente Copywriter" description="Landing pages · Instagram · LinkedIn · Emails · Slogans · Pitches · Guiones">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <div>
              <Label className="text-[10px]">Tipo de contenido</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COPY_TIPOS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setCopyTipo(t.value)}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${copyTipo === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/30'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">Negocio</Label>
                <Input className="h-7 text-xs bg-secondary mt-1" placeholder="Nexus Digital..." value={copyNegocio} onChange={(e) => setCopyNegocio(e.target.value)} /></div>
              <div><Label className="text-[10px]">Sector objetivo</Label>
                <Input className="h-7 text-xs bg-secondary mt-1" placeholder="Restaurantes..." value={copySector} onChange={(e) => setCopySector(e.target.value)} /></div>
            </div>
            <div><Label className="text-[10px]">Detalles adicionales</Label>
              <Textarea className="text-xs bg-secondary resize-none min-h-[60px] mt-1" placeholder="Servicios específicos, tono deseado, oferta especial..." value={copyDetalles} onChange={(e) => setCopyDetalles(e.target.value)} />
            </div>
            <Button className="w-full h-8 text-xs gap-1.5" disabled={copyMut.isPending} onClick={() => { setCopyResult(null); copyMut.mutate() }}>
              {copyMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Escribiendo...</> : <><Sparkles className="w-3.5 h-3.5" /> Generar contenido</>}
            </Button>
          </div>
          {copyResult && (
            <div className="relative p-3 rounded-lg bg-secondary border border-border text-xs leading-relaxed max-h-80 overflow-y-auto">
              <button className="absolute top-2 right-2 text-muted-foreground hover:text-foreground z-10" onClick={() => { navigator.clipboard.writeText(copyResult.contenido); setCopyCopied(true); setTimeout(() => setCopyCopied(false), 2000) }}>
                {copyCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <p className="text-[10px] text-primary font-medium mb-2 uppercase tracking-wider">{copyResult.label}</p>
              <pre className="whitespace-pre-wrap font-sans pr-6 text-muted-foreground">{copyResult.contenido}</pre>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCCIÓN TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProduccionTab() {
  const qc = useQueryClient()
  const [propuestaLeadId, setPropuestaLeadId] = useState('')
  const [propuestaResult, setPropuestaResult] = useState<any>(null)
  const [requisitosLeadId, setRequisitosLeadId] = useState('')
  const [requisitosResult, setRequisitosResult] = useState<any>(null)
  const [constructorProyId, setConstructorProyId] = useState('')
  const [constructorResult, setConstructorResult] = useState<any>(null)

  const { data: leadsData } = useQuery({
    queryKey: ['leads-produccion'],
    queryFn: async () => {
      const res = await fetch('/api/leads?limit=30')
      return res.json()
    },
  })
  const { data: proyData } = useQuery({
    queryKey: ['proyectos-produccion'],
    queryFn: async () => {
      const res = await fetch('/api/proyectos')
      return res.json()
    },
  })

  const leads: any[] = leadsData?.leads ?? []
  const proyectos: any[] = proyData?.proyectos ?? proyData ?? []

  const propuestasMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/propuestas-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: propuestaLeadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => { setPropuestaResult(data.propuesta); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const requisitosMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/requisitos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: requisitosLeadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setRequisitosResult(data.requisitos),
  })

  const constructorMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/constructor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId: constructorProyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => { setConstructorResult(data.plan); qc.invalidateQueries({ queryKey: ['proyectos'] }) },
  })

  const LeadSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select className="w-full h-7 text-xs bg-secondary border border-border rounded-md px-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecciona un lead...</option>
      {leads.map((l: any) => <option key={l.id} value={l.id}>{l.nombre} — {l.sector ?? '?'} ({l.estado})</option>)}
    </select>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Propuestas IA */}
      <SectionCard title="Generador de Propuestas" description="Crea una propuesta comercial completa a partir de los datos del lead">
        <div className="space-y-2.5">
          <div><Label className="text-[10px]">Lead</Label><div className="mt-1"><LeadSelect value={propuestaLeadId} onChange={setPropuestaLeadId} /></div></div>
          <Button className="w-full h-8 text-xs gap-1.5" disabled={propuestasMut.isPending || !propuestaLeadId} onClick={() => { setPropuestaResult(null); propuestasMut.mutate() }}>
            {propuestasMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><FileText className="w-3.5 h-3.5" /> Generar propuesta</>}
          </Button>
          {propuestasMut.isError && <p className="text-xs text-destructive">{(propuestasMut.error as Error).message}</p>}
          {propuestaResult && (
            <div className="p-2.5 bg-secondary rounded-lg border border-border space-y-1.5 text-xs">
              <div className="flex justify-between items-start">
                <p className="font-semibold">{propuestaResult.servicioOfrecido}</p>
                {propuestaResult.precioEstimado && <span className="text-primary font-bold">{propuestaResult.precioEstimado}€</span>}
              </div>
              {propuestaResult.solucionPropuesta && <p className="text-muted-foreground">{propuestaResult.solucionPropuesta}</p>}
              {propuestaResult.plazoEstimado && <p className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {propuestaResult.plazoEstimado}</p>}
              <Link href="/propuestas" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">Ver en propuestas <ChevronRight className="w-3 h-3" /></Link>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Requisitos */}
      <SectionCard title="Recopilador de Requisitos" description="Genera cuestionario de requisitos para iniciar un proyecto">
        <div className="space-y-2.5">
          <div><Label className="text-[10px]">Lead</Label><div className="mt-1"><LeadSelect value={requisitosLeadId} onChange={setRequisitosLeadId} /></div></div>
          <Button className="w-full h-8 text-xs gap-1.5" disabled={requisitosMut.isPending || !requisitosLeadId} onClick={() => { setRequisitosResult(null); requisitosMut.mutate() }}>
            {requisitosMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><ClipboardList className="w-3.5 h-3.5" /> Generar requisitos</>}
          </Button>
          {requisitosMut.isError && <p className="text-xs text-destructive">{(requisitosMut.error as Error).message}</p>}
          {requisitosResult && (
            <div className="p-2.5 bg-secondary rounded-lg border border-border text-xs space-y-2 max-h-64 overflow-y-auto">
              <p className="font-semibold">{requisitosResult.titulo}</p>
              {requisitosResult.preguntas?.map((cat: any, i: number) => (
                <div key={i}>
                  <p className="text-[10px] text-primary font-medium uppercase tracking-wider mb-1">{cat.categoria}</p>
                  {cat.preguntas?.map((q: string, j: number) => <p key={j} className="text-[10px] text-muted-foreground mb-0.5">· {q}</p>)}
                </div>
              ))}
              {requisitosResult.advertencias?.[0] && (
                <div className="flex gap-1 pt-1"><AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" /><p className="text-[10px] text-amber-400">{requisitosResult.advertencias[0]}</p></div>
              )}
              <p className="text-[10px] text-green-400">✓ Tarea de seguimiento creada</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Constructor de proyectos */}
      <SectionCard title="Constructor de Proyectos" description="Genera plan completo: fases, tareas, entregables y riesgos">
        <div className="space-y-2.5">
          <div>
            <Label className="text-[10px]">Proyecto</Label>
            <select className="w-full h-7 text-xs bg-secondary border border-border rounded-md px-2 mt-1" value={constructorProyId} onChange={(e) => setConstructorProyId(e.target.value)}>
              <option value="">Selecciona un proyecto...</option>
              {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} — {p.etapa}</option>)}
            </select>
          </div>
          <Button className="w-full h-8 text-xs gap-1.5" disabled={constructorMut.isPending || !constructorProyId} onClick={() => { setConstructorResult(null); constructorMut.mutate() }}>
            {constructorMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando plan...</> : <><Hammer className="w-3.5 h-3.5" /> Generar plan</>}
          </Button>
          {constructorMut.isError && <p className="text-xs text-destructive">{(constructorMut.error as Error).message}</p>}
          {constructorResult && (
            <div className="p-2.5 bg-secondary rounded-lg border border-border text-xs space-y-2 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Plan generado</p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{constructorResult.duracion_total}</span>
              </div>
              {constructorResult.fases?.map((fase: any, i: number) => (
                <div key={i} className="pl-2 border-l-2 border-primary/30">
                  <p className="text-[10px] font-medium text-primary">{fase.nombre} <span className="text-muted-foreground font-normal">({fase.duracion})</span></p>
                  {fase.tareas?.slice(0, 3).map((t: string, j: number) => <p key={j} className="text-[10px] text-muted-foreground">· {t}</p>)}
                </div>
              ))}
              {constructorResult.proxima_accion && (
                <div className="flex items-start gap-1 pt-1 border-t border-border">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-400">{constructorResult.proxima_accion}</p>
                </div>
              )}
              <p className="text-[10px] text-green-400">✓ Plan guardado en el proyecto</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISIS TAB
// ─────────────────────────────────────────────────────────────────────────────

function AnalisisTab() {
  const [resumen, setResumen] = useState<string | null>(null)
  const [insightsResult, setInsightsResult] = useState<any>(null)

  const resumenMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/resumen-diario', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setResumen(data.resumen),
  })

  const insightsMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/insights', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      return data
    },
    onSuccess: (data) => setInsightsResult(data),
  })

  const SALUD_COLOR = (score: number) => score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
  const TENDENCIA_ICON: Record<string, string> = { creciendo: '↑', estable: '→', bajando: '↓' }

  const { data: metricasData } = useQuery({
    queryKey: ['metricas-analisis'],
    queryFn: async () => {
      const res = await fetch('/api/metricas')
      return res.json()
    },
    staleTime: 120_000,
  })

  return (
    <div className="space-y-4">
      {/* Funnel de conversión */}
      {metricasData?.funnel && (
        <SectionCard title="Embudo de Conversión" description="Tasa de avance en cada etapa del pipeline">
          <div className="space-y-1.5">
            {metricasData.funnel.map((f: any) => (
              <div key={f.etapa} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-28 shrink-0">{f.etapa}</span>
                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-full" style={{ width: `${f.porcentaje}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{f.count}</span>
                <span className="text-[10px] text-primary w-8 text-right shrink-0">{f.porcentaje}%</span>
              </div>
            ))}
          </div>
          {metricasData.conversionPorSector?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Conversión por sector</p>
              <div className="flex flex-wrap gap-2">
                {metricasData.conversionPorSector.slice(0, 5).map((s: any) => (
                  <div key={s.sector} className="bg-secondary px-2 py-1 rounded text-center">
                    <p className="text-[10px] text-muted-foreground">{s.sector}</p>
                    <p className="text-xs font-bold text-primary">{s.tasa}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Resumen diario */}
      <SectionCard title="Resumen Diario" description="Análisis ejecutivo del CRM y próximas acciones prioritarias">
        <div className="space-y-2.5">
          <Button className="w-full h-8 text-xs gap-1.5" variant="outline" disabled={resumenMut.isPending} onClick={() => { setResumen(null); resumenMut.mutate() }}>
            {resumenMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><Sparkles className="w-3.5 h-3.5" /> Generar resumen del día</>}
          </Button>
          {resumenMut.isError && <p className="text-xs text-destructive">{(resumenMut.error as Error).message}</p>}
          {resumen && (
            <div className="relative p-3 rounded-lg bg-primary/5 border border-primary/15">
              <button className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onClick={() => setResumen(null)}><X className="w-3 h-3" /></button>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap pr-4">{resumen}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Insights estratégicos */}
      <SectionCard title="Insights Estratégicos" description="Análisis profundo del negocio con métricas reales y recomendaciones">
        <div className="space-y-2.5">
          <Button className="w-full h-8 text-xs gap-1.5" disabled={insightsMut.isPending} onClick={() => { setInsightsResult(null); insightsMut.mutate() }}>
            {insightsMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analizando...</> : <><BarChart3 className="w-3.5 h-3.5" /> Analizar negocio</>}
          </Button>
          {insightsMut.isError && <p className="text-xs text-destructive">{(insightsMut.error as Error).message}</p>}
          {insightsResult && (
            <div className="space-y-3">
              {/* Health score */}
              <div className="flex items-center gap-3 p-2.5 bg-secondary rounded-lg">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${SALUD_COLOR(insightsResult.insights?.puntuacion_salud ?? 0)}`}>
                    {insightsResult.insights?.puntuacion_salud ?? '—'}
                  </p>
                  <p className="text-[9px] text-muted-foreground">salud</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium flex items-center gap-1">
                    {TENDENCIA_ICON[insightsResult.insights?.tendencia ?? 'estable']} {insightsResult.insights?.tendencia ?? '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{insightsResult.insights?.resumen_ejecutivo}</p>
                </div>
              </div>

              {/* Metrics grid */}
              {insightsResult.metricas && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Total leads', value: insightsResult.metricas.totalLeads },
                    { label: 'En pipeline', value: insightsResult.metricas.leadsEnPipeline },
                    { label: 'Respuesta', value: `${insightsResult.metricas.responseRateMonth}%` },
                    { label: 'Conversión', value: `${insightsResult.metricas.conversionRate}%` },
                    { label: 'Ganados', value: `${insightsResult.metricas.totalValorGanado}€` },
                    { label: 'Esta semana', value: `+${insightsResult.metricas.leadsEstaSemana}` },
                  ].map((m) => (
                    <div key={m.label} className="p-1.5 bg-secondary rounded text-center">
                      <p className="text-xs font-bold">{m.value}</p>
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {insightsResult.insights?.acciones_prioritarias?.map((a: any, i: number) => (
                <div key={i} className={`p-2.5 rounded-lg border space-y-1 ${a.prioridad === 'alta' ? 'bg-primary/5 border-primary/20' : 'bg-secondary border-border'}`}>
                  <p className="text-xs font-semibold">{a.accion}</p>
                  <p className="text-[10px] text-muted-foreground">{a.justificacion}</p>
                  <p className="text-[10px] text-green-400">→ {a.impacto}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
    </div>
  )
}
