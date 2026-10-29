'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Upload, Trash2, Download, File, FileImage,
  FileSpreadsheet, Presentation, X, Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const CATEGORIAS = ['Contrato', 'Propuesta', 'Factura', 'Presentación', 'Informe', 'Otro']

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return FileImage
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet
  if (mime.includes('presentation') || mime.includes('powerpoint')) return Presentation
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) return FileText
  return File
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mimeColor(mime: string) {
  if (mime.includes('pdf')) return 'bg-red-500/10 border-red-500/20 text-red-400'
  if (mime.startsWith('image/')) return 'bg-purple-500/10 border-purple-500/20 text-purple-400'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'bg-green-500/10 border-green-500/20 text-green-400'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'bg-orange-500/10 border-orange-500/20 text-orange-400'
  return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
}

export default function DocumentosPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['documentos', filtroCategoria],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filtroCategoria) params.set('categoria', filtroCategoria)
      const res = await fetch(`/api/documentos?${params}`)
      return res.json()
    },
  })

  const documentos: any[] = data?.documentos ?? []

  async function handleUpload() {
    if (!pendingFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('nombre', nombre || pendingFile.name)
      if (descripcion) fd.append('descripcion', descripcion)
      if (categoria) fd.append('categoria', categoria)
      const res = await fetch('/api/documentos', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Error al subir')
      qc.invalidateQueries({ queryKey: ['documentos'] })
      setPendingFile(null)
      setNombre('')
      setDescripcion('')
      setCategoria('')
      setShowForm(false)
    } finally {
      setUploading(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos'] }),
  })

  async function handleDownload(id: string) {
    const res = await fetch(`/api/documentos/${id}`)
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) { setPendingFile(file); setNombre(file.name); setShowForm(true) }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { setPendingFile(file); setNombre(file.name); setShowForm(true) }
    e.target.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Documentos"
        description={`${documentos.length} archivo${documentos.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileInputRef.current?.click()}>
            <Plus className="w-3.5 h-3.5" /> Subir archivo
          </Button>
        }
      />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {/* Formulario de subida */}
      {showForm && pendingFile && (
        <SectionCard title="">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Nuevo documento</p>
              <button onClick={() => { setShowForm(false); setPendingFile(null) }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
              {(() => { const Icon = fileIcon(pendingFile.type); return <Icon className="w-5 h-5 text-muted-foreground shrink-0" /> })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{pendingFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 outline-none focus:border-primary/50"
                  placeholder="Nombre del documento"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 outline-none focus:border-primary/50"
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descripción (opcional)</label>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 outline-none focus:border-primary/50"
                placeholder="Añade una descripción..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setPendingFile(null) }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? <><Upload className="w-3.5 h-3.5 animate-bounce mr-1.5" />Subiendo...</> : <><Upload className="w-3.5 h-3.5 mr-1.5" />Subir</>}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Zona drag & drop */}
      {!showForm && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
            dragging ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-secondary/50'
          )}
        >
          <Upload className={cn('w-6 h-6', dragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm text-muted-foreground text-center">
            Arrastra un archivo aquí o <span className="text-primary">haz clic para seleccionar</span>
          </p>
          <p className="text-xs text-muted-foreground/60">PDF, Word, Excel, imágenes... hasta 50 MB</p>
        </div>
      )}

      {/* Filtros categoría */}
      {documentos.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('')}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              filtroCategoria === '' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary border-border text-muted-foreground hover:text-foreground')}
          >
            Todos
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(filtroCategoria === c ? '' : c)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                filtroCategoria === c ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary border-border text-muted-foreground hover:text-foreground')}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Lista de documentos */}
      <SectionCard title="">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" />)}
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin documentos</p>
            <p className="text-xs text-muted-foreground mt-1">Sube tu primer documento usando el botón de arriba</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documentos.map((doc: any) => {
              const Icon = fileIcon(doc.mimeType)
              return (
                <div key={doc.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center shrink-0', mimeColor(doc.mimeType))}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {doc.categoria && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary border border-border text-muted-foreground">
                          {doc.categoria}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.tamano)}</span>
                      {doc.lead && (
                        <span className="text-xs text-muted-foreground">· {doc.lead.nombre}</span>
                      )}
                      {doc.descripcion && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">· {doc.descripcion}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground mr-1 hidden sm:block">
                      {format(new Date(doc.createdAt), 'dd MMM', { locale: es })}
                    </span>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Descargar"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar este documento?')) deleteMutation.mutate(doc.id) }}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
