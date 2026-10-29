'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Send, Inbox, ChevronLeft, ChevronRight, Tag, ExternalLink, Check, X, Eye, EyeOff, MailOpen } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const TIPO_TABS = [
  { key: '', label: 'Todos', icon: Mail },
  { key: 'recibido', label: 'Recibidos', icon: Inbox },
  { key: 'enviado', label: 'Enviados', icon: Send },
]

const CLASIFICACION_COLORS: Record<string, string> = {
  positivo:      'bg-green-500/10 text-green-400 border-green-500/20',
  interes:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pregunta:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutro:        'bg-secondary text-muted-foreground border-border',
  negativo:      'bg-red-500/10 text-red-400 border-red-500/20',
  precio:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  no_clasificado:'bg-secondary text-muted-foreground border-border',
}

const CLASIFICACION_LABELS: Record<string, string> = {
  positivo: 'Positivo', interes: 'Interés', pregunta: 'Pregunta',
  neutro: 'Neutro', negativo: 'Negativo', precio: 'Precio', no_clasificado: 'Sin clasificar',
}

export default function EmailsPage() {
  const [tipo, setTipo] = useState('')
  const [page, setPage] = useState(1)
  const [mostrarLeidos, setMostrarLeidos] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['emails', tipo, page, mostrarLeidos],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) })
      if (tipo) params.set('tipo', tipo)
      // En recibidos: por defecto ocultar los ya leídos
      if (tipo === 'recibido' && !mostrarLeidos) params.set('noLeidos', 'true')
      const res = await fetch(`/api/emails?${params}`)
      return res.json()
    },
  })

  const markRead = useMutation({
    mutationFn: async (emailId: string) => {
      await fetch(`/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leido: true }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  })

  const noInteresa = useMutation({
    mutationFn: async (leadId: string) => {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'descartado' }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  })

  const emails: any[] = data?.emails ?? []
  const total: number = data?.total ?? 0
  const pages: number = data?.pages ?? 1

  function handleTipo(key: string) {
    setTipo(key)
    setPage(1)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Bandeja de entrada"
        description={`${total} emails`}
      />

      {/* Tabs + toggle leídos */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
          {TIPO_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTipo(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tipo === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tipo === 'recibido' && (
          <button
            onClick={() => setMostrarLeidos((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {mostrarLeidos ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {mostrarLeidos ? 'Ocultar leídos' : 'Mostrar leídos'}
          </button>
        )}
      </div>

      <SectionCard title="">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin emails</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tipo === 'recibido' && !mostrarLeidos
                ? 'No hay emails no leídos. Pulsa "Mostrar leídos" para verlos todos.'
                : 'No hay emails en esta categoría todavía.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map((email: any) => (
              <div
                key={email.id}
                className={cn(
                  'py-3 first:pt-0 last:pb-0 group',
                  email.leido && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icono tipo */}
                  <div className={cn(
                    'w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5',
                    email.tipo === 'recibido'
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-blue-500/10 border-blue-500/20'
                  )}>
                    {email.tipo === 'recibido'
                      ? <Inbox className="w-3.5 h-3.5 text-green-400" />
                      : <Send className="w-3.5 h-3.5 text-blue-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Asunto */}
                    <p className={cn('text-sm font-medium truncate', !email.leido && 'font-semibold')}>
                      {email.asunto ?? '(sin asunto)'}
                    </p>

                    {/* Lead + remitente/destinatario */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {email.lead ? (
                        <Link
                          href={`/leads/${email.lead.id}`}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        >
                          {email.lead.nombre}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {email.tipo === 'recibido'
                          ? `De: ${email.remitente ?? '?'}`
                          : `Para: ${email.destinatario ?? '?'}`}
                      </span>
                    </div>

                    {/* Preview del cuerpo */}
                    {email.cuerpo && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {email.cuerpo}
                      </p>
                    )}
                  </div>

                  {/* Derecha: clasificación + fecha + acciones */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(email.fecha), 'dd MMM HH:mm', { locale: es })}
                    </span>
                    {email.tipo === 'enviado' && email.abierto && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20" title={email.fechaApertura ? `Abierto el ${new Date(email.fechaApertura).toLocaleString('es-ES')}` : 'Abierto'}>
                        <MailOpen className="w-2.5 h-2.5" />
                        Abierto
                      </span>
                    )}
                    {email.clasificacion && email.clasificacion !== 'no_clasificado' && (
                      <span className={cn(
                        'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border',
                        CLASIFICACION_COLORS[email.clasificacion] ?? CLASIFICACION_COLORS.no_clasificado
                      )}>
                        <Tag className="w-2.5 h-2.5" />
                        {CLASIFICACION_LABELS[email.clasificacion] ?? email.clasificacion}
                      </span>
                    )}

                    {/* Acciones — visibles en hover o siempre en móvil */}
                    {email.tipo === 'recibido' && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!email.leido && (
                          <button
                            title="Marcar como leído"
                            onClick={() => markRead.mutate(email.id)}
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            <Check className="w-2.5 h-2.5" />
                            Leído
                          </button>
                        )}
                        {email.lead && (
                          <button
                            title="No me interesa este lead"
                            onClick={() => {
                              markRead.mutate(email.id)
                              noInteresa.mutate(email.lead.id)
                            }}
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                            No interesa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Página {page} de {pages} · {total} emails
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
