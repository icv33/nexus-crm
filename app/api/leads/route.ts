import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const prioridad = searchParams.get('prioridad')
  const sector = searchParams.get('sector')
  const tieneEmail = searchParams.get('tieneEmail')   // 'si' | 'no'
  const tieneWeb = searchParams.get('tieneWeb')       // 'si' | 'no'
  const search = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') ?? '100')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const where: Record<string, unknown> = {}
  if (estado) where.estado = estado.includes(',') ? { in: estado.split(',') } : estado
  if (prioridad) where.prioridad = prioridad.includes(',') ? { in: prioridad.split(',') } : prioridad
  if (sector) where.sector = { contains: sector, mode: 'insensitive' }
  if (tieneEmail === 'si') where.email = { not: null }
  if (tieneEmail === 'no') where.email = null
  if (tieneWeb === 'si') where.web = { not: null }
  if (tieneWeb === 'no') where.web = null
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { sector: { contains: search, mode: 'insensitive' } },
      { ciudad: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { _count: { select: { actividades: true, tareas: true } } },
    }),
    prisma.lead.count({ where }),
  ])

  return NextResponse.json({ leads, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const lead = await prisma.lead.create({
    data: {
      nombre: body.nombre,
      sector: body.sector,
      ciudad: body.ciudad ?? 'Zaragoza',
      web: body.web,
      email: body.email,
      telefono: body.telefono,
      fuente: body.fuente,
      problemaDetectado: body.problemaDetectado,
      servicioRecomendado: body.servicioRecomendado,
      puntuacion: body.puntuacion ?? 5,
      prioridad: body.prioridad ?? 'media',
      estado: body.estado ?? 'nuevo',
      valorEstimado: body.valorEstimado,
      notas: body.notas,
      proximaAccion: body.proximaAccion,
    },
  })

  await prisma.actividad.create({
    data: {
      tipo: 'lead_creado',
      descripcion: `Lead creado: ${lead.nombre}`,
      leadId: lead.id,
    },
  })

  return NextResponse.json(lead, { status: 201 })
}
