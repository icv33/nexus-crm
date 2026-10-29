import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const tipo = searchParams.get('tipo')
  const prioridad = searchParams.get('prioridad')
  const where: Record<string, unknown> = {}
  if (estado) where.estado = estado.includes(',') ? { in: estado.split(',') } : estado
  if (tipo) where.tipo = tipo
  if (prioridad) where.prioridad = prioridad

  const [tareas, total] = await Promise.all([
    prisma.tarea.findMany({
      where,
      orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
      include: {
        lead: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    }),
    prisma.tarea.count({ where }),
  ])
  return NextResponse.json({ tareas, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const tarea = await prisma.tarea.create({
    data: {
      titulo: body.titulo,
      descripcion: body.descripcion,
      prioridad: body.prioridad ?? 'media',
      tipo: body.tipo ?? 'accion',
      vencimiento: body.vencimiento ? new Date(body.vencimiento) : undefined,
      origen: body.origen ?? 'manual',
      leadId: body.leadId,
      proyectoId: body.proyectoId,
    },
  })
  return NextResponse.json(tarea, { status: 201 })
}
