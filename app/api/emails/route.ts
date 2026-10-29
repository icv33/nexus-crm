import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') // 'enviado' | 'recibido' | null (todos)
  const clasificacion = searchParams.get('clasificacion')
  const soloNoLeidos = searchParams.get('noLeidos') === 'true'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 30

  const where: Record<string, unknown> = {}
  if (tipo) where.tipo = tipo
  if (clasificacion) where.clasificacion = clasificacion
  // Recibidos: solo emails de leads reales (excluye rebotes y auto-respuestas sin lead)
  if (tipo === 'recibido') where.leadId = { not: null }
  if (soloNoLeidos) where.leido = false

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lead: { select: { id: true, nombre: true, sector: true } },
      },
    }),
    prisma.email.count({ where }),
  ])

  return NextResponse.json({ emails, total, page, pages: Math.ceil(total / limit) })
}
