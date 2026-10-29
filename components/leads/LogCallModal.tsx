'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RESULTADOS = [
  { value: 'contactado',       label: '✅ Contactado', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { value: 'no_contesta',      label: '📵 No contesta', color: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' },
  { value: 'interesado',       label: '🔥 Interesado', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: 'no_interesa',      label: '❌ No interesa', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  { value: 'callback',         label: '🔁 Me llama él', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { value: 'ya_tiene',         label: '🚫 Ya tiene proveedor', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
]

interface Props {
  leadId: string
  leadNombre: string
  onClose: () => void
}

export function LogCallModal({ leadId, leadNombre, onClose }: Props) {
  const [resultado, setResultado] = useState('contactado')
  const [notas, setNotas] = useState('')
  const [duracion, setDuracion] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      // Registrar como actividad
      await fetch(`/api/leads/${leadId}/llamada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado, notas, duracion: duracion ? parseInt(duracion) : null }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Registrar llamada</p>
              <p className="text-[10px] text-muted-foreground">{leadNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resultado */}
          <div>
            <p className="text-xs font-medium mb-2">Resultado de la llamada</p>
            <div className="grid grid-cols-2 gap-1.5">
              {RESULTADOS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setResultado(r.value)}
                  className={cn(
                    'text-xs px-3 py-2 rounded-lg border transition-colors text-left',
                    resultado === r.value ? r.color : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duración */}
          <div>
            <p className="text-xs font-medium mb-1.5">Duración (minutos, opcional)</p>
            <input
              type="number"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              placeholder="ej. 5"
              min="1"
              className="w-full text-xs bg-secondary rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-medium mb-1.5">Notas de la conversación</p>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Qué dijo, próximos pasos, puntos clave..."
              rows={3}
              className="w-full text-xs bg-secondary rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1 h-9 text-xs" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-9 text-xs gap-1.5" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Check className="w-3.5 h-3.5" /> Guardar llamada
          </Button>
        </div>
      </div>
    </div>
  )
}
