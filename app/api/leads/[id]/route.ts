import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      actividades: { orderBy: { createdAt: 'desc' }, take: 20 },
      tareas: { orderBy: { createdAt: 'desc' } },
      propuestas: { orderBy: { createdAt: 'desc' } },
      emails: { orderBy: { fecha: 'desc' }, take: 10 },
      reuniones: { orderBy: { fechaInicio: 'asc' } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Whitelist campos permitidos para evitar sobreescritura de relaciones
  const CAMPOS_PERMITIDOS = ['nombre', 'sector', 'ciudad', 'web', 'email', 'telefono', 'fuente',
    'problemaDetectado', 'servicioRecomendado', 'puntuacion', 'prioridad', 'estado', 'valorEstimado',
    'emailPreparado', 'emailEnviado', 'fechaEnvio', 'respuestaRecibida', 'resumenRespuesta',
    'notas', 'notasLlamada', 'proximaAccion', 'campaniaId', 'ultimoContactoEn']
  const safeData: Record<string, unknown> = {}
  for (const key of CAMPOS_PERMITIDOS) {
    if (key in body) safeData[key] = body[key]
  }

  const prev = await prisma.lead.findUnique({ where: { id }, select: { estado: true } })

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...safeData,
      updatedAt: new Date(),
      ...(body.estado && body.estado !== prev?.estado ? { ultimoContactoEn: new Date() } : {}),
    },
  })

  if (body.estado && body.estado !== prev?.estado) {
    await prisma.actividad.create({
      data: {
        tipo: 'estado_cambiado',
        descripcion: `Estado cambiado de ${prev?.estado} a ${body.estado}`,
        leadId: id,
        metadata: { de: prev?.estado, a: body.estado },
      },
    })
  }

  return NextResponse.json(lead)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  await prisma.lead.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
