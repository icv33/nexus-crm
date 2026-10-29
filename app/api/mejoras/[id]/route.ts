import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const { estado, prioridad, titulo, descripcion } = await req.json()
  const data: any = {}
  if (estado) data.estado = estado
  if (prioridad) data.prioridad = prioridad
  if (titulo) data.titulo = titulo
  if (descripcion) data.descripcion = descripcion
  const mejora = await prisma.mejora.update({ where: { id }, data })
  return NextResponse.json(mejora)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  await prisma.mejora.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
