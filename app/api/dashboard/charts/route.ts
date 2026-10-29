import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subWeeks, startOfWeek, format } from 'date-fns'
import { es } from 'date-fns/locale'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const hace8Semanas = subWeeks(new Date(), 8)

  const [leadsRecientes, emailsRecientes, sectorStats, aperturas] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: hace8Semanas } },
      select: { createdAt: true },
    }),
    prisma.email.findMany({
      where: { tipo: 'enviado', fecha: { gte: hace8Semanas } },
      select: { fecha: true },
    }),
    prisma.lead.groupBy({
      by: ['sector'],
      _count: true,
      where: { sector: { not: null } },
      orderBy: { _count: { sector: 'desc' } },
      take: 7,
    }),
    prisma.email.count({ where: { tipo: 'enviado', abierto: true } }),
  ])

  // Construir semanas (últimas 8)
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const inicio = startOfWeek(subWeeks(new Date(), 7 - i), { weekStartsOn: 1 })
    return { inicio, label: format(inicio, 'd MMM', { locale: es }) }
  })

  function bucketPorSemana(fechas: Date[]) {
    return semanas.map(({ inicio }) => {
      const fin = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000)
      return fechas.filter((f) => f >= inicio && f < fin).length
    })
  }

  const leadsXSemana = bucketPorSemana(leadsRecientes.map((l) => new Date(l.createdAt)))
  const emailsXSemana = bucketPorSemana(emailsRecientes.map((e) => new Date(e.fecha)))

  const actividadSemanal = semanas.map(({ label }, i) => ({
    semana: label,
    leads: leadsXSemana[i],
    emails: emailsXSemana[i],
  }))

  const sectores = sectorStats
    .filter((s) => s.sector)
    .map((s) => ({ sector: s.sector!.split(' ')[0], leads: s._count }))

  const totalEnviados = await prisma.email.count({ where: { tipo: 'enviado' } })
  const tasaApertura = totalEnviados > 0 ? Math.round((aperturas / totalEnviados) * 100) : 0

  return NextResponse.json({ actividadSemanal, sectores, tasaApertura, totalEnviados, aperturas })
}
