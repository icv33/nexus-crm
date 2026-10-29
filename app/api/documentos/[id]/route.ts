import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabase, BUCKET } from '@/lib/supabase-storage'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const doc = await prisma.documento.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storagePath, 3600)

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo generar la URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl, nombre: doc.nombre, mimeType: doc.mimeType })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const doc = await prisma.documento.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([doc.storagePath])
  await prisma.documento.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
