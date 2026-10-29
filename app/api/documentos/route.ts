import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabase, BUCKET } from '@/lib/supabase-storage'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const leadId = searchParams.get('leadId')

  const where: Record<string, unknown> = {}
  if (categoria) where.categoria = categoria
  if (leadId) where.leadId = leadId

  const documentos = await prisma.documento.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lead: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
    },
  })

  return NextResponse.json({ documentos })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const nombre = formData.get('nombre') as string | null
  const descripcion = formData.get('descripcion') as string | null
  const categoria = formData.get('categoria') as string | null
  const leadId = formData.get('leadId') as string | null
  const proyectoId = formData.get('proyectoId') as string | null

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
  }

  const documento = await prisma.documento.create({
    data: {
      nombre: nombre || file.name,
      descripcion: descripcion || null,
      categoria: categoria || null,
      storagePath,
      mimeType: file.type,
      tamano: file.size,
      leadId: leadId || null,
      proyectoId: proyectoId || null,
    },
  })

  return NextResponse.json(documento, { status: 201 })
}
