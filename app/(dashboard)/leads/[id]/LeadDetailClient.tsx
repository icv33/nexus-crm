'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Mail, Globe, Phone, ExternalLink, Edit2, Check, X,
  MapPin, Star, Send, Clock, CheckSquare, ChevronRight,
  RefreshCw, Copy, Trash2, PhoneCall, Plus, MailOpen,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { LogCallModal } from '@/components/leads/LogCallModal'

const ESTADOS = [
  'nuevo', 'analizado', 'preparado_para_contactar', 'contactado',
  'respondio', 'interesado', 'reunion_agendada', 'propuesta_pendiente',
  'propuesta_enviada', 'negociacion', 'ganado', 'perdido', 'descartado',
]

const ACTIVITY_ICONS: Record<string, string> = {
  lead_creado: '🎯', email_enviado: '📤', email_recibido: '📥',
  estado_cambiado: '🔄', nota_agregada: '📝', reunion_agendada: '📅',
  propuesta_creada: '📄', tarea_creada: '✅', agente_ejecutado: '🤖',
  email_encontrado: '🔍', proyecto_creado: '🚀', llamada_realizada: '📞',
}

const SEMAFORO_COLORS: Record<string, string> = {
  verde:    'bg-green-500/10 text-green-400 border-green-500/20',
  amarillo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rojo:     'bg-red-500/10 text-red-400 border-red-500/20',
}

export function LeadDetailClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)
  const qc = useQueryClient()
  const router = useRouter()

  const [editingNota, setEditingNota] = useState(false)
  const [editingAccion, setEditingAccion] = useState(false)
  const [notaVal, setNotaVal] = useState('')
  const [accionVal, setAccionVal] = useState('')
  const [copied, setCopied] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const [borradorText, setBorradorText] = useState<string | null>(null)
  const [editingBorrador, setEditingBorrador] = useState(false)

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error('Lead no encontrado')
      return res.json()
    },
  })

  const patchMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => router.push('/leads'),
  })

  const enviarBorradorMutation = useMutation({
    mutationFn: async (texto: string) => {
      const res = await fetch(`/api/leads/${id}/enviar-borrador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Error') }
    },
    onSuccess: () => {
      setEditingBorrador(false)
      setBorradorText(null)
      qc.invalidateQueries({ queryKey: ['lead', id] })
    },
  })

  const descartarBorradorMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/leads/${id}/enviar-borrador`, { method: 'DELETE' })
    },
    onSuccess: () => {
      setEditingBorrador(false)
      setBorradorText(null)
      qc.invalidateQueries({ queryKey: ['lead', id] })
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-32 rounded bg-secondary animate-pulse" />
        <div className="h-20 rounded-xl bg-card border border-border animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-96 rounded-xl bg-card border border-border animate-pulse" />
          <div className="h-96 rounded-xl bg-card border border-border animate-pulse" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Lead no encontrado</p>
        <Link href="/leads" className="text-primary text-sm mt-2 inline-block">← Volver a leads</Link>
      </div>
    )
  }

  const copyEmail = () => {
    if (lead.email) {
      navigator.clipboard.writeText(lead.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const saveNota = () => {
    patchMutation.mutate({ notas: notaVal })
    setEditingNota(false)
  }

  const saveAccion = () => {
    patchMutation.mutate({ proximaAccion: accionVal })
    setEditingAccion(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a leads
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{lead.nombre}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {lead.sector && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3" />{lead.sector}
                </span>
              )}
              {lead.ciudad && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{lead.ciudad}
                </span>
              )}
              {lead.puntuacion != null && (
                <span className="text-xs text-muted-foreground">
                  Puntuación: <span className="text-foreground font-medium">{lead.puntuacion}/10</span>
                </span>
              )}
              {lead.emailEnviado && (
                <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-md">
                  Email enviado
                </span>
              )}
            </div>
            {lead.puntuacion != null && (
              <div className="mt-2.5 h-1.5 bg-secondary rounded-full max-w-xs">
                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${lead.puntuacion * 10}%` }} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {lead.semaforo && lead.semaforo !== 'verde' && (
              <span className={cn('text-[10px] px-2 py-1 rounded-lg border font-medium', SEMAFORO_COLORS[lead.semaforo])}>
                {lead.semaforo === 'rojo' ? '🔴 Rojo' : '🟡 Amarillo'}
              </span>
            )}
            <Select value={lead.estado} onValueChange={(v) => patchMutation.mutate({ estado: v })}>
              <SelectTrigger className="h-8 w-52 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e} className="text-xs">{e.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PriorityBadge priority={lead.prioridad} />
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => setShowCallModal(true)}>
              <PhoneCall className="w-3.5 h-3.5" /> Llamada
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main: actividad + emails + propuestas */}
        <div className="lg:col-span-2 space-y-4">

          {/* Borrador pendiente de aprobación */}
          {lead.borradorRespuesta && (
            <div className="bg-amber-500/5 border-2 border-amber-500/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">✉️</span>
                  <h3 className="text-sm font-semibold text-amber-400">Borrador pendiente — requiere tu aprobación</h3>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">PENDIENTE</span>
              </div>
              {editingBorrador ? (
                <Textarea
                  className="text-xs bg-secondary border-amber-500/30 resize-none min-h-[100px] mb-3"
                  value={borradorText ?? lead.borradorRespuesta}
                  onChange={(e) => setBorradorText(e.target.value)}
                  autoFocus
                />
              ) : (
                <div
                  className="text-xs text-muted-foreground leading-relaxed bg-secondary rounded-lg p-3 mb-3 whitespace-pre-wrap cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => { setBorradorText(lead.borradorRespuesta); setEditingBorrador(true) }}
                  title="Haz clic para editar"
                >
                  {lead.borradorRespuesta}
                  <p className="text-[10px] text-amber-400/60 mt-1">← Haz clic para editar antes de enviar</p>
                </div>
              )}
              <div className="flex gap-2">
                {!editingBorrador && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => { setBorradorText(lead.borradorRespuesta); setEditingBorrador(true) }}
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                  disabled={enviarBorradorMutation.isPending}
                  onClick={() => enviarBorradorMutation.mutate(borradorText ?? lead.borradorRespuesta)}
                >
                  {enviarBorradorMutation.isPending
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : <Send className="w-3 h-3" />}
                  Enviar respuesta
                </Button>
                <button
                  onClick={() => descartarBorradorMutation.mutate()}
                  disabled={descartarBorradorMutation.isPending}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors text-[10px] flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Descartar
                </button>
              </div>
              {enviarBorradorMutation.isError && (
                <p className="text-xs text-destructive mt-2">{(enviarBorradorMutation.error as Error).message}</p>
              )}
            </div>
          )}

          {/* Actividad */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Actividad</h3>
            {!lead.actividades?.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sin actividad registrada</p>
            ) : (
              <div className="space-y-3">
                {lead.actividades.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <span className="text-sm leading-none mt-0.5 shrink-0">{ACTIVITY_ICONS[a.tipo] ?? '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">{a.descripcion}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {format(new Date(a.createdAt), 'dd MMM HH:mm', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emails */}
          {lead.emails?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3">Emails ({lead.emails.length})</h3>
              <div className="space-y-2">
                {lead.emails.map((email: any) => (
                  <div key={email.id} className={cn(
                    'p-3 rounded-lg border text-xs',
                    email.tipo === 'enviado'
                      ? 'bg-primary/5 border-primary/15'
                      : 'bg-green-500/5 border-green-500/15'
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium', email.tipo === 'enviado' ? 'text-primary' : 'text-green-400')}>
                          {email.tipo === 'enviado' ? '📤 Enviado' : '📥 Recibido'}
                        </span>
                        {email.tipo === 'enviado' && email.abierto && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                            <MailOpen className="w-3 h-3" /> Abierto
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[10px]">
                        {format(new Date(email.fecha), 'dd MMM yyyy HH:mm', { locale: es })}
                      </span>
                    </div>
                    {email.asunto && <p className="font-medium text-foreground mb-1">{email.asunto}</p>}
                    {email.cuerpo && (
                      <p className="text-muted-foreground leading-relaxed line-clamp-4">{email.cuerpo}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Propuestas */}
          {lead.propuestas?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3">Propuestas ({lead.propuestas.length})</h3>
              <div className="space-y-2">
                {lead.propuestas.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary border border-border">
                    <div>
                      <p className="text-xs font-medium">{p.servicioOfrecido?.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        v{p.version} · {format(new Date(p.createdAt), 'dd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.precioEstimado && (
                        <span className="text-xs text-green-400 font-medium">
                          €{p.precioEstimado.toLocaleString('es-ES')}
                        </span>
                      )}
                      <StatusBadge status={p.estado} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar derecho */}
        <div className="space-y-4">

          {/* Contacto */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3">Contacto</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {lead.email ? (
                    <span className="text-xs truncate">{lead.email}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sin email</span>
                  )}
                </div>
                {lead.email && (
                  <button onClick={copyEmail} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {lead.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs">{lead.telefono}</span>
                </div>
              )}

              {lead.web && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {lead.web.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                  <a href={lead.web} target="_blank" rel="noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0 ml-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {lead.email && (
                <a href={`mailto:${lead.email}`}
                  className="mt-1 flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs hover:bg-primary/20 transition-colors">
                  <Send className="w-3 h-3" /> Enviar email
                </a>
              )}
            </div>
          </div>

          {/* Problema detectado */}
          {(lead.problemaDetectado || lead.servicioRecomendado) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium mb-2">Análisis</h3>
              {lead.problemaDetectado && (
                <p className="text-xs text-muted-foreground leading-relaxed">{lead.problemaDetectado}</p>
              )}
              {lead.servicioRecomendado && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Servicio recomendado</span>
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    {lead.servicioRecomendado.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Notas</h3>
              {!editingNota && (
                <button
                  onClick={() => { setNotaVal(lead.notas ?? ''); setEditingNota(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingNota ? (
              <div className="space-y-2">
                <Textarea
                  className="text-xs bg-secondary border-border resize-none min-h-[80px]"
                  value={notaVal}
                  onChange={(e) => setNotaVal(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNota(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={saveNota} disabled={patchMutation.isPending}>
                    <Check className="w-3 h-3 mr-1" /> Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lead.notas || <span className="italic">Sin notas. Haz clic en ✎ para añadir.</span>}
              </p>
            )}
          </div>

          {/* Próxima acción */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Próxima acción</h3>
              {!editingAccion && (
                <button
                  onClick={() => { setAccionVal(lead.proximaAccion ?? ''); setEditingAccion(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingAccion ? (
              <div className="space-y-2">
                <Input
                  className="h-8 text-xs bg-secondary border-border"
                  value={accionVal}
                  onChange={(e) => setAccionVal(e.target.value)}
                  placeholder="Llamar el lunes, enviar propuesta..."
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveAccion(); if (e.key === 'Escape') setEditingAccion(false) }}
                />
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingAccion(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={saveAccion} disabled={patchMutation.isPending}>
                    <Check className="w-3 h-3 mr-1" /> Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {lead.proximaAccion
                  ? <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-amber-400" />{lead.proximaAccion}</span>
                  : <span className="italic">Sin acción definida</span>}
              </p>
            )}
          </div>

          {/* Tareas */}
          {lead.tareas?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Tareas ({lead.tareas.length})</h3>
                <Link href="/tareas" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                  Ver todas <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {lead.tareas.slice(0, 4).map((t: any) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{t.titulo}</p>
                      <StatusBadge status={t.estado} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadatos */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium mb-1">Información</h3>
            <MetaRow label="Fuente" value={lead.fuente ?? '—'} />
            <MetaRow label="Creado" value={format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: es })} />
            {lead.fechaEnvio && (
              <MetaRow label="Email enviado" value={format(new Date(lead.fechaEnvio), 'dd MMM yyyy', { locale: es })} />
            )}
            {lead.ultimoContactoEn && (
              <MetaRow label="Último contacto" value={format(new Date(lead.ultimoContactoEn), 'dd MMM yyyy', { locale: es })} />
            )}
            {lead.valorEstimado && (
              <MetaRow label="Valor estimado" value={`€${lead.valorEstimado.toLocaleString('es-ES')}`} />
            )}
          </div>

          {/* Eliminar */}
          <button
            onClick={() => {
              if (confirm(`¿Eliminar el lead "${lead.nombre}"? Esta acción no se puede deshacer.`))
                deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-destructive/30 text-destructive/70 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            {deleteMutation.isPending
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
            Eliminar lead
          </button>
        </div>
      </div>

      {showCallModal && (
        <LogCallModal
          leadId={id}
          leadNombre={lead.nombre}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-medium">{value}</span>
    </div>
  )
}
