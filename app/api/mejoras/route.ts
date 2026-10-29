import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const where: any = {}
  if (estado && estado !== 'todas') where.estado = estado
  const mejoras = await prisma.mejora.findMany({ where, orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }] })
  return NextResponse.json(mejoras)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { titulo, descripcion, prioridad } = await req.json()
  if (!titulo || !descripcion) return NextResponse.json({ error: 'titulo y descripcion requeridos' }, { status: 400 })
  const mejora = await prisma.mejora.create({ data: { titulo, descripcion, prioridad: prioridad ?? 'media' } })
  return NextResponse.json(mejora, { status: 201 })
}
