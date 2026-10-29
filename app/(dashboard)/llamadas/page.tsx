'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, Search, Save, User, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LlamadasPage() {
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [notas, setNotas] = useState('')
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['leads-llamada-search', search],
    queryFn: async () => {
      const res = await fetch(`/api/leads?q=${encodeURIComponent(search)}&limit=10`)
      return res.json()
    },
    enabled: search.length > 1,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notasLlamada: notas }),
      })
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const leads: any[] = data?.leads ?? []

  const selectLead = (lead: any) => {
    setSelectedLead(lead)
    setNotas(lead.notasLlamada ?? '')
    setSearch(lead.nombre)
    setSaved(false)
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title="Preparar llamada"
        description="Busca un cliente y escribe tus notas antes de hablar"
      />

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedLead(null) }}
          placeholder="Busca por nombre..."
          className="w-full pl-9 pr-4 py-3 text-sm bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          autoFocus
        />
        {leads.length > 0 && !selectedLead && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
            {leads.map((lead: any) => (
              <button
                key={lead.id}
                onClick={() => selectLead(lead)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
              >
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.nombre}</p>
                  <p className="text-xs text-muted-foreground">{[lead.sector, lead.ciudad].filter(Boolean).join(' · ')}</p>
                </div>
                {lead.telefono && (
                  <span className="text-xs text-green-400 shrink-0">{lead.telefono}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ficha del lead seleccionado */}
      {selectedLead && (
        <div className="space-y-4">
          {/* Info */}
          <div className="p-4 bg-secondary border border-border rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/leads/${selectedLead.id}`} className="text-sm font-semibold hover:text-primary transition-colors">
                  {selectedLead.nombre}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[selectedLead.sector, selectedLead.ciudad].filter(Boolean).join(' · ')}
                </p>
              </div>
              {selectedLead.telefono && (
                <a
                  href={`tel:${selectedLead.telefono}`}
                  className="flex items-center gap-1.5 text-sm font-medium text-green-400 hover:text-green-300 transition-colors shrink-0"
                >
                  <Phone className="w-4 h-4" />
                  {selectedLead.telefono}
                </a>
              )}
            </div>

            {selectedLead.resumenRespuesta && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Último email de ellos</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">"{selectedLead.resumenRespuesta}"</p>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Notas para la llamada</label>
            <textarea
              value={notas}
              onChange={(e) => { setNotas(e.target.value); setSaved(false) }}
              placeholder={'¿Qué quieres decirle?\n¿Qué preguntas tienes?\n¿Qué acordasteis la última vez?'}
              className="w-full h-52 px-4 py-3 text-sm bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-shadow"
            />
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar notas'}
          </Button>
        </div>
      )}
    </div>
  )
}
