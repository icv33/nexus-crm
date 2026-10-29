import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function csv(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const sector = searchParams.get('sector')
  const prioridad = searchParams.get('prioridad')

  const where: Record<string, unknown> = {}
  if (estado) where.estado = { in: estado.split(',') }
  if (sector) where.sector = { contains: sector, mode: 'insensitive' }
  if (prioridad) where.prioridad = { in: prioridad.split(',') }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ puntuacion: 'desc' }, { createdAt: 'desc' }],
    select: {
      nombre: true, sector: true, ciudad: true, email: true, telefono: true,
      web: true, estado: true, prioridad: true, puntuacion: true,
      emailEnviado: true, fechaEnvio: true, problemaDetectado: true,
      servicioRecomendado: true, notas: true, createdAt: true,
    },
  })

  const HEADERS = [
    'Nombre', 'Sector', 'Ciudad', 'Email', 'Teléfono', 'Web',
    'Estado', 'Prioridad', 'Puntuación', 'Email enviado', 'Fecha envío',
    'Problema detectado', 'Servicio recomendado', 'Notas', 'Fecha creación',
  ]

  const rows = leads.map((l) =>
    [
      l.nombre, l.sector, l.ciudad, l.email, l.telefono, l.web,
      l.estado, l.prioridad, l.puntuacion,
      l.emailEnviado ? 'Sí' : 'No',
      l.fechaEnvio ? new Date(l.fechaEnvio).toLocaleDateString('es-ES') : '',
      l.problemaDetectado, l.servicioRecomendado, l.notas,
      new Date(l.createdAt).toLocaleDateString('es-ES'),
    ]
      .map(csv)
      .join(','),
  )

  // BOM UTF-8 para que Excel lo abra correctamente con tildes y ñ
  const content = '﻿' + [HEADERS.join(','), ...rows].join('\r\n')
  const fecha = new Date().toISOString().split('T')[0]

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads_nexus_${fecha}.csv"`,
    },
  })
}
