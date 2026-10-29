'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Users, Mail, Send, MessageSquare, Star,
  Calendar, FileText, FolderKanban, CheckSquare, DollarSign,
  TrendingUp, Bot, Activity, AlertCircle, Clock, ChevronRight,
  Sparkles, RefreshCw, X, Phone, Globe, AlertTriangle,
} from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { DashboardCharts } from '@/components/dashboard/Charts'

const PIPELINE_COLS = [
  { key: 'nuevo',            label: 'Nuevo' },
  { key: 'contactado',       label: 'Contactado' },
  { key: 'respondio',        label: 'Respondió' },
  { key: 'interesado',       label: 'Interesado' },
  { key: 'reunion_agendada', label: 'Reunión' },
  { key: 'propuesta_enviada',label: 'Propuesta' },
  { key: 'negociacion',      label: 'Negociación' },
  { key: 'ganado',           label: 'Ganado' },
  { key: 'perdido',          label: 'Perdido' },
]

const ACTIVITY_ICONS: Record<string, string> = {
  lead_creado: '🎯', email_enviado: '📤', email_recibido: '📥',
  estado_cambiado: '🔄', nota_agregada: '📝', reunion_agendada: '📅',
  propuesta_creada: '📄', tarea_creada: '✅', agente_ejecutado: '🤖',
  email_encontrado: '🔍',
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState<string | null>(null)
  const [showResumen, setShowResumen] = useState(false)
  const [sinEmailExpanded, setSinEmailExpanded] = useState(false)

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard')
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const resumenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agentes/resumen-diario', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error generando resumen')
      return data
    },
    onSuccess: (data) => {
      setResumen(data.resumen)
      setShowResumen(true)
    },
  })

  const stats = data?.stats
  const pipeline: { estado: string; _count: { _all: number } }[] = data?.pipeline ?? []
  const actividad: any[] = data?.actividadReciente ?? []
  const tareas: any[] = data?.tareasPrioritarias ?? []
  const agentes: any[] = data?.agentes ?? []
  const altaPrioridadSinEmail: any[] = data?.altaPrioridadSinEmail ?? []
  const borradorsPendientes: any[] = data?.borradorsPendientes ?? []

  const pipelineMax = Math.max(1, ...pipeline.map((p) => p._count._all))

  const fmt = (n: number) =>
    n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${n}`

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Dashboard"
        description={today.charAt(0).toUpperCase() + today.slice(1)}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            disabled={resumenMutation.isPending}
            onClick={() => { setShowResumen(false); resumenMutation.mutate() }}
          >
            {resumenMutation.isPending
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</>
              : <><Sparkles className="w-3.5 h-3.5" /> Resumen del día</>}
          </Button>
        }
      />

      {/* Resumen IA */}
      {showResumen && resumen && (
        <div className="relative p-4 bg-primary/5 border border-primary/15 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-primary mb-2">Resumen generado por IA</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{resumen}</p>
            </div>
            <button onClick={() => setShowResumen(false)} className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta borradores pendientes */}
      {borradorsPendientes.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">
              {borradorsPendientes.length === 1
                ? '1 respuesta pendiente de tu aprobación'
                : `${borradorsPendientes.length} respuestas pendientes de tu aprobación`}
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {borradorsPendientes.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                >
                  ✉️ {l.nombre} <ChevronRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {resumenMutation.isError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
          {(resumenMutation.error as Error).message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
        <StatCard title="Leads nuevos"          value={isLoading ? '—' : stats?.leadsNuevos ?? 0}           icon={Users}         color="blue"    href="/leads?estado=nuevo" />
        <StatCard title="Leads analizados"      value={isLoading ? '—' : stats?.leadsAnalizados ?? 0}       icon={Star}          color="blue"    href="/leads?estado=analizado" />
        <StatCard title="Con email sin enviar"  value={isLoading ? '—' : stats?.correosPreparados ?? 0}     icon={Mail}          color="default" href="/leads?tieneEmail=si" />
        <StatCard title="Enviados hoy"          value={isLoading ? '—' : stats?.correosEnviadosHoy ?? 0}    icon={Send}          color="default" href="/leads?estado=contactado" />
        <StatCard title="Respuestas"            value={isLoading ? '—' : stats?.respuestasRecibidas ?? 0}   icon={MessageSquare} color="green"   href="/leads?estado=respondio" />
        <StatCard title="Interesados"           value={isLoading ? '—' : stats?.leadsInteresados ?? 0}      icon={Star}          color="orange"  href="/leads?estado=interesado" />
        <StatCard title="Reuniones próximas"    value={isLoading ? '—' : stats?.reunionesAgendadas ?? 0}    icon={Calendar}      color="blue"    href="/calendario" />
        <StatCard title="Propuestas pend."      value={isLoading ? '—' : stats?.propuestasPendientes ?? 0}  icon={FileText}      color="orange"  href="/propuestas" />
        <StatCard title="Proyectos activos"     value={isLoading ? '—' : stats?.proyectosActivos ?? 0}      icon={FolderKanban}  color="green"   href="/proyectos" />
        <StatCard title="Tareas pendientes"     value={isLoading ? '—' : stats?.tareasPendientes ?? 0}      icon={CheckSquare}   color="orange"  href="/tareas" />
        <StatCard title="Ingresos est."         value={isLoading ? '—' : fmt(stats?.ingresosEstimados ?? 0)} icon={DollarSign}   color="green"   href="/finanzas" />
        <StatCard title="MRR estimado"          value={isLoading ? '—' : fmt(stats?.mrr ?? 0)}              icon={TrendingUp}    color="green"   href="/finanzas" />
        <StatCard title="Tasa de respuesta"     value={isLoading ? '—' : `${stats?.tasaRespuesta ?? 0}%`}   icon={MessageSquare} color="green"   href="/leads?estado=respondio" />
        <StatCard title="Tasa de conversión"    value={isLoading ? '—' : `${stats?.tasaConversion ?? 0}%`}  icon={TrendingUp}    color="orange"  href="/leads?estado=ganado" />
      </div>

      {/* Gráficas */}
      <DashboardCharts />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Actividad reciente */}
        <SectionCard
          title="Actividad reciente"
          className="lg:col-span-2"
          actions={
            <Link href="/leads" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Ver leads <ChevronRight className="w-3 h-3" />
            </Link>
          }
        >
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-secondary animate-pulse" />)}
            </div>
          ) : actividad.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Sin actividad registrada</p>
              <p className="text-xs text-muted-foreground mt-1">Crea tu primer lead o ejecuta el pipeline</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actividad.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5 shrink-0">{ACTIVITY_ICONS[a.tipo] ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{a.descripcion}</p>
                    {a.lead && (
                      <Link href={`/leads/${a.lead.id ?? ''}`} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                        {a.lead.nombre}
                      </Link>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(a.createdAt), "dd MMM HH:mm", { locale: es })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Tareas urgentes + leads sin email */}
        <SectionCard
          title="Pendiente de revisión"
          actions={
            <Link href="/tareas" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Ver tareas <ChevronRight className="w-3 h-3" />
            </Link>
          }
        >
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded bg-secondary animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Leads sin email — colapsado por defecto */}
              {altaPrioridadSinEmail.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setSinEmailExpanded(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors text-left"
                  >
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{altaPrioridadSinEmail.length} leads</span> sin correo por llamar
                    </span>
                    {sinEmailExpanded
                      ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90 transition-transform" />
                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform" />}
                  </button>
                  {sinEmailExpanded && (
                    <div className="border-t border-border divide-y divide-border/50">
                      {altaPrioridadSinEmail.map((l: any) => (
                        <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{l.nombre}</p>
                            <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                              <Phone className="w-2.5 h-2.5" /> {l.telefono}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{l.puntuacion}/10</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tareas urgentes reales */}
              {tareas.map((t: any) => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary border border-border">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.titulo}</p>
                    {t.lead && (
                      <Link href={`/leads/${t.lead.id ?? ''}`} className="text-[10px] text-muted-foreground hover:text-primary">
                        {t.lead.nombre}
                      </Link>
                    )}
                  </div>
                </div>
              ))}

              {tareas.length === 0 && altaPrioridadSinEmail.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3">
                    <CheckSquare className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Todo al día</p>
                  <p className="text-xs text-muted-foreground mt-1">Sin pendientes urgentes</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Pipeline */}
        <SectionCard
          title="Pipeline de ventas"
          className="lg:col-span-2"
          actions={
            <Link href="/ventas" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Ver kanban <ChevronRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-1">
              {PIPELINE_COLS.map((col) => {
                const entry = pipeline.find((p) => p.estado === col.key)
                const count = entry?._count._all ?? 0
                const pct = Math.round((count / pipelineMax) * 100)
                return (
                  <Link key={col.key} href={`/leads?estado=${col.key}`} className="flex flex-col gap-1.5 w-28 group/col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium group-hover/col:text-foreground transition-colors">{col.label}</span>
                      <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-1.5 rounded-full bg-primary transition-all duration-500 group-hover/col:bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </SectionCard>

        {/* Agentes */}
        <SectionCard
          title="Agentes del sistema"
          actions={
            <Link href="/agentes" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Gestionar <ChevronRight className="w-3 h-3" />
            </Link>
          }
        >
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-7 rounded bg-secondary animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1.5">
              {agentes.map((agent: any) => (
                <div key={agent.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate max-w-[130px]">{agent.nombre}</span>
                  </div>
                  <StatusBadge status={agent.estado} />
                </div>
              ))}
              {agentes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin agentes configurados</p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Oportunidades activas */}
      {!isLoading && (stats?.leadsInteresados ?? 0) > 0 && (
        <SectionCard title="Oportunidades activas">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm flex-1">
              Tienes <span className="font-semibold text-amber-400">{stats.leadsInteresados} leads</span> en etapas avanzadas del pipeline que necesitan atención.
            </p>
            <Link href="/ventas" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0">
              Ver pipeline <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
