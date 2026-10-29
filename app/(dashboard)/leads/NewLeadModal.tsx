'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function NewLeadModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    nombre: '', sector: '', ciudad: 'Zaragoza', web: '', email: '',
    telefono: '', fuente: 'manual', servicioRecomendado: '',
    problemaDetectado: '', puntuacion: 5, prioridad: 'media',
    valorEstimado: '', notas: '',
  })

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          valorEstimado: data.valorEstimado ? parseFloat(data.valorEstimado) : undefined,
        }),
      })
      if (!res.ok) throw new Error('Error al crear el lead')
      return res.json()
    },
    onSuccess: () => { onCreated(); onClose() },
  })

  const set = (key: string, val: string | number) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-sm font-semibold">Nuevo lead</h2>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Nombre del negocio *</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="Restaurante El Sol" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sector</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="Restauración" value={form.sector} onChange={(e) => set('sector', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ciudad</Label>
              <Input className="h-8 text-sm bg-secondary border-border" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="email" placeholder="info@negocio.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="+34 600 000 000" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Web</Label>
              <Input className="h-8 text-sm bg-secondary border-border" placeholder="https://..." value={form.web} onChange={(e) => set('web', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fuente</Label>
              <Select value={form.fuente} onValueChange={(v) => v && set('fuente', v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['manual', 'google_maps', 'instagram', 'referido', 'web', 'linkedin', 'otro'].map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Servicio recomendado</Label>
              <Select value={form.servicioRecomendado} onValueChange={(v) => v && set('servicioRecomendado', v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {['web', 'mejora_web', 'whatsapp', 'automatizacion_correos', 'automatizacion_formularios', 'sistema_reservas', 'automatizacion_interna'].map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => v && set('prioridad', v)}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                  <SelectItem value="media" className="text-xs">Media</SelectItem>
                  <SelectItem value="baja" className="text-xs">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Puntuación (1-10)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" min={1} max={10} value={form.puntuacion} onChange={(e) => set('puntuacion', parseInt(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor estimado (€)</Label>
              <Input className="h-8 text-sm bg-secondary border-border" type="number" placeholder="500" value={form.valorEstimado} onChange={(e) => set('valorEstimado', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Problema detectado</Label>
              <Textarea className="text-sm bg-secondary border-border resize-none" rows={2} placeholder="No tienen presencia online, web desactualizada..." value={form.problemaDetectado} onChange={(e) => set('problemaDetectado', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea className="text-sm bg-secondary border-border resize-none" rows={2} placeholder="Notas internas sobre este lead..." value={form.notas} onChange={(e) => set('notas', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="text-xs" disabled={!form.nombre || mutation.isPending} onClick={() => mutation.mutate(form)}>
            {mutation.isPending ? 'Creando...' : 'Crear lead'}
          </Button>
        </div>
      </div>
    </div>
  )
}
