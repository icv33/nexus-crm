import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [proyectos, total] = await Promise.all([
    prisma.proyecto.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { select: { nombre: true } },
        empresa: { select: { nombre: true } },
        tareas: { where: { estado: 'pendiente' }, select: { id: true } },
      },
    }),
    prisma.proyecto.count(),
  ])
  return NextResponse.json({ proyectos, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const proyecto = await prisma.proyecto.create({
    data: {
      nombre: body.nombre,
      leadId: body.leadId,
      empresaId: body.empresaId,
      propuestaId: body.propuestaId,
      servicioVendido: body.servicioVendido,
      valorTotal: body.valorTotal,
      fechaEntregaEstimada: body.fechaEntregaEstimada ? new Date(body.fechaEntregaEstimada) : undefined,
    },
  })

  if (body.leadId) {
    await prisma.actividad.create({
      data: {
        tipo: 'proyecto_creado',
        descripcion: `Proyecto creado: ${proyecto.nombre}`,
        leadId: body.leadId,
        proyectoId: proyecto.id,
      },
    })
  }

  return NextResponse.json(proyecto, { status: 201 })
}
