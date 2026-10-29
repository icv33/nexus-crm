import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [propuestas, total] = await Promise.all([
    prisma.propuesta.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lead: { select: { nombre: true, email: true } } },
    }),
    prisma.propuesta.count(),
  ])
  return NextResponse.json({ propuestas, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const propuesta = await prisma.propuesta.create({
    data: {
      leadId: body.leadId,
      servicioOfrecido: body.servicioOfrecido,
      problemaDetectado: body.problemaDetectado,
      solucionPropuesta: body.solucionPropuesta,
      precioEstimado: body.precioEstimado,
      plazoEstimado: body.plazoEstimado,
      estado: 'borrador',
      notas: body.notas,
    },
  })

  await prisma.actividad.create({
    data: {
      tipo: 'propuesta_creada',
      descripcion: `Propuesta creada: ${body.servicioOfrecido}`,
      leadId: body.leadId,
    },
  })

  return NextResponse.json(propuesta, { status: 201 })
}
