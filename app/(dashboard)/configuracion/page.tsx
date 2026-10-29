'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Shield, CheckCircle2 } from 'lucide-react'

type Config = {
  TARGET_CITY: string
  AUTO_SEND_EMAILS: string
  DAILY_EMAIL_LIMIT: string
  AUTO_NEGOTIATION: string
  AUTO_CALENDAR_BOOKING: string
  MAX_MEETINGS_PER_DAY: string
  DEFAULT_MEETING_DURATION: string
  MEETING_BUFFER_MINUTES: string
  PRICE_APPROVAL_THRESHOLD: string
  MEETING_START_MORNING: string
  MEETING_END_MORNING: string
  MEETING_START_AFTERNOON: string
  MEETING_END_AFTERNOON: string
}

const DEFAULTS: Config = {
  TARGET_CITY: 'Zaragoza',
  AUTO_SEND_EMAILS: 'false',
  DAILY_EMAIL_LIMIT: '5',
  AUTO_NEGOTIATION: 'true',
  AUTO_CALENDAR_BOOKING: 'true',
  MAX_MEETINGS_PER_DAY: '3',
  DEFAULT_MEETING_DURATION: '30',
  MEETING_BUFFER_MINUTES: '15',
  PRICE_APPROVAL_THRESHOLD: '500',
  MEETING_START_MORNING: '10:00',
  MEETING_END_MORNING: '14:00',
  MEETING_START_AFTERNOON: '17:00',
  MEETING_END_AFTERNOON: '20:00',
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config>(DEFAULTS)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/config')
      return res.json() as Promise<Config>
    },
  })

  useEffect(() => {
    if (data) setConfig(data)
  }, [data])

  const mutation = useMutation({
    mutationFn: async (cfg: Config) => {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      return res.json()
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const set = (k: keyof Config, v: string) => setConfig((c) => ({ ...c, [k]: v }))

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="h-16 rounded-xl bg-card border border-border animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-card border border-border animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Configuración" description="Parámetros del sistema y agentes" />

      <div className="space-y-5">
        {/* Captación */}
        <SectionCard title="Captación y emails" description="Controla el envío automático de correos">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ciudad objetivo</Label>
              <Input className="h-8 text-sm bg-secondary border-border" value={config.TARGET_CITY} onChange={(e) => set('TARGET_CITY', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Límite diario de emails</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" min={1} max={50} value={config.DAILY_EMAIL_LIMIT} onChange={(e) => set('DAILY_EMAIL_LIMIT', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Auto envío de emails</Label>
              <Select value={config.AUTO_SEND_EMAILS} onValueChange={(v) => v && set('AUTO_SEND_EMAILS', v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true" className="text-xs">Activado (riesgo)</SelectItem>
                  <SelectItem value="false" className="text-xs">Desactivado (recomendado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Calendario */}
        <SectionCard title="Calendario y reuniones">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Duración reunión (min)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" value={config.DEFAULT_MEETING_DURATION} onChange={(e) => set('DEFAULT_MEETING_DURATION', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Margen entre reuniones (min)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" value={config.MEETING_BUFFER_MINUTES} onChange={(e) => set('MEETING_BUFFER_MINUTES', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Máx. reuniones por día</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" value={config.MAX_MEETINGS_PER_DAY} onChange={(e) => set('MAX_MEETINGS_PER_DAY', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Auto agendado</Label>
              <Select value={config.AUTO_CALENDAR_BOOKING} onValueChange={(v) => v && set('AUTO_CALENDAR_BOOKING', v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true" className="text-xs">Activado</SelectItem>
                  <SelectItem value="false" className="text-xs">Desactivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horario mañana (inicio)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="time" value={config.MEETING_START_MORNING} onChange={(e) => set('MEETING_START_MORNING', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horario mañana (fin)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="time" value={config.MEETING_END_MORNING} onChange={(e) => set('MEETING_END_MORNING', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horario tarde (inicio)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="time" value={config.MEETING_START_AFTERNOON} onChange={(e) => set('MEETING_START_AFTERNOON', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horario tarde (fin)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="time" value={config.MEETING_END_AFTERNOON} onChange={(e) => set('MEETING_END_AFTERNOON', e.target.value)} />
            </div>
          </div>
        </SectionCard>

        {/* Seguridad */}
        <SectionCard title="Seguridad y nivel de autonomía">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
              <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-400">Reglas de seguridad activas</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  El sistema no puede enviar propuestas económicas sin tu aprobación, prometer precios o plazos cerrados,
                  ofrecer descuentos, ni cerrar ventas complejas de forma autónoma.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Umbral de precio para aprobación (€)</Label>
                <Input className="h-8 text-sm bg-secondary border-border" type="number" value={config.PRICE_APPROVAL_THRESHOLD} onChange={(e) => set('PRICE_APPROVAL_THRESHOLD', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Auto negociación básica</Label>
                <Select value={config.AUTO_NEGOTIATION} onValueChange={(v) => v && set('AUTO_NEGOTIATION', v)}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" className="text-xs">Activada</SelectItem>
                    <SelectItem value="false" className="text-xs">Desactivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Configuración guardada
            </div>
          )}
          <Button
            className="gap-1.5 text-xs"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(config)}
          >
            <Save className="w-3.5 h-3.5" />
            {mutation.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </div>
    </div>
  )
}
