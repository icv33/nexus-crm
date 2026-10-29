import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [campanas, total] = await Promise.all([
    prisma.campania.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { leads: true } } } }),
    prisma.campania.count(),
  ])
  return NextResponse.json({ campanas, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const campana = await prisma.campania.create({
    data: {
      nombre: body.nombre,
      ciudadObjetivo: body.ciudadObjetivo ?? 'Zaragoza',
      sectorObjetivo: body.sectorObjetivo,
      limiteDiarioEmails: body.limiteDiarioEmails ?? 5,
    },
  })
  return NextResponse.json(campana, { status: 201 })
}
