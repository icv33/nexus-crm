import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  const tarea = await prisma.tarea.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
    },
  })
  if (!tarea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(tarea)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const tarea = await prisma.tarea.update({ where: { id }, data: body })
  return NextResponse.json(tarea)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  await prisma.tarea.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
