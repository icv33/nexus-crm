import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [total, conEmail, conWeb, sinWebSinEmail, puntuacion7plus, listos] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { email: { not: null } } }),
    prisma.lead.count({ where: { web: { not: null }, email: null } }),
    prisma.lead.count({ where: { web: null, email: null } }),
    prisma.lead.count({ where: { puntuacion: { gte: 7 } } }),
    prisma.lead.count({ where: { puntuacion: { gte: 7 }, email: { not: null }, emailEnviado: false, estado: 'analizado' } }),
  ])

  return NextResponse.json({ total, conEmail, conWeb, sinWebSinEmail, puntuacion7plus, listos })
}
