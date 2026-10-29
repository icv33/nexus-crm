import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subDays, differenceInDays } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const hace30 = subDays(new Date(), 30)
  const hace7 = subDays(new Date(), 7)
  const hace14 = subDays(new Date(), 14)

  const [
    // Embudo completo
    totalLeads,
    leadsByEstado,
    // Timing
    leadsConFechaContacto,
    // Seguimiento
    leadsBySegCount,
    // Semáforo
    leadsBySemaforo,
    leadsByRiesgo,
    // Propuestas
    propuestasByEstado,
    // Proyectos
    proyectosByEtapa,
    // Emails
    emailsEnviados30,
    emailsRecibidos30,
    // Reuniones
    reunionesPasadas30,
    reunionesFuturas,
    // Actividad reciente
    ultimasActividades,
    // Conversiones por sector
    leadsByEstadoSector,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.lead.findMany({
      where: { fechaEnvio: { not: null }, createdAt: { gte: hace30 } },
      select: { createdAt: true, fechaEnvio: true, estado: true },
    }),
    prisma.lead.groupBy({
      by: ['seguimientoCount'],
      _count: { _all: true },
      where: { seguimientoCount: { gt: 0 } },
    }),
    prisma.lead.groupBy({ by: ['semaforo'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['riesgoComercial'], _count: { _all: true } }),
    prisma.propuesta.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.proyecto.groupBy({ by: ['etapa'], _count: { _all: true } }),
    prisma.email.count({ where: { tipo: 'enviado', fecha: { gte: hace30 } } }),
    prisma.email.count({ where: { tipo: 'recibido', fecha: { gte: hace30 } } }),
    prisma.reunion.count({ where: { fechaInicio: { gte: hace30, lt: new Date() } } }),
    prisma.reunion.findMany({
      where: { fechaInicio: { gte: new Date() } },
      include: { lead: { select: { nombre: true, sector: true } } },
      orderBy: { fechaInicio: 'asc' },
      take: 5,
    }),
    prisma.actividad.findMany({
      where: { createdAt: { gte: hace7 } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { lead: { select: { nombre: true } } },
    }),
    prisma.lead.groupBy({
      by: ['estado', 'sector'],
      _count: { _all: true },
      where: { sector: { not: null } },
    }),
  ])

  // ── Funnel de conversión ─────────────────────────────────────────────────
  const estadoMap = Object.fromEntries(leadsByEstado.map((e) => [e.estado, e._count._all]))

  const funnel = [
    { etapa: 'Leads totales', count: totalLeads, porcentaje: 100 },
    {
      etapa: 'Contactados',
      count: (estadoMap['contactado'] ?? 0) + (estadoMap['seguimiento_1'] ?? 0) + (estadoMap['seguimiento_2'] ?? 0) + (estadoMap['seguimiento_3'] ?? 0) + (estadoMap['respondio'] ?? 0) + (estadoMap['interesado'] ?? 0) + (estadoMap['reunion_agendada'] ?? 0) + (estadoMap['propuesta_pendiente'] ?? 0) + (estadoMap['propuesta_enviada'] ?? 0) + (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    {
      etapa: 'Respondieron',
      count: (estadoMap['respondio'] ?? 0) + (estadoMap['interesado'] ?? 0) + (estadoMap['reunion_agendada'] ?? 0) + (estadoMap['propuesta_pendiente'] ?? 0) + (estadoMap['propuesta_enviada'] ?? 0) + (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    {
      etapa: 'Interesados',
      count: (estadoMap['interesado'] ?? 0) + (estadoMap['reunion_agendada'] ?? 0) + (estadoMap['propuesta_pendiente'] ?? 0) + (estadoMap['propuesta_enviada'] ?? 0) + (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    {
      etapa: 'Reuniones',
      count: (estadoMap['reunion_agendada'] ?? 0) + (estadoMap['propuesta_pendiente'] ?? 0) + (estadoMap['propuesta_enviada'] ?? 0) + (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    {
      etapa: 'Propuestas',
      count: (estadoMap['propuesta_pendiente'] ?? 0) + (estadoMap['propuesta_enviada'] ?? 0) + (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    {
      etapa: 'Negociación',
      count: (estadoMap['negociacion'] ?? 0) + (estadoMap['ganado'] ?? 0),
      porcentaje: 0,
    },
    { etapa: 'Ganados', count: estadoMap['ganado'] ?? 0, porcentaje: 0 },
  ]

  funnel.forEach((f) => {
    f.porcentaje = totalLeads > 0 ? Math.round((f.count / totalLeads) * 100) : 0
  })

  // ── Tiempo medio de conversión (creación → envío email) ──────────────────
  const tiemposMedio =
    leadsConFechaContacto.length > 0
      ? Math.round(
          leadsConFechaContacto.reduce((sum, l) => sum + differenceInDays(l.fechaEnvio!, l.createdAt), 0) /
            leadsConFechaContacto.length,
        )
      : null

  // ── Tasas de respuesta ────────────────────────────────────────────────────
  const tasaRespuesta = emailsEnviados30 > 0
    ? Math.round((emailsRecibidos30 / emailsEnviados30) * 100)
    : 0

  // ── Distribución semáforo ─────────────────────────────────────────────────
  const semaforoMap = Object.fromEntries(leadsBySemaforo.map((s) => [s.semaforo, s._count._all]))
  const riesgoMap = Object.fromEntries(leadsByRiesgo.map((r) => [r.riesgoComercial, r._count._all]))

  // ── Sectores con más conversiones ────────────────────────────────────────
  const ganados = leadsByEstadoSector.filter((l) => l.estado === 'ganado')
  const total_sector = leadsByEstadoSector.reduce((acc, l) => {
    acc[l.sector!] = (acc[l.sector!] ?? 0) + l._count._all
    return acc
  }, {} as Record<string, number>)

  const conversionPorSector = ganados.map((g) => ({
    sector: g.sector,
    ganados: g._count._all,
    total: total_sector[g.sector!] ?? 0,
    tasa: total_sector[g.sector!]
      ? Math.round((g._count._all / total_sector[g.sector!]) * 100)
      : 0,
  })).sort((a, b) => b.tasa - a.tasa).slice(0, 6)

  return NextResponse.json({
    ok: true,
    funnel,
    semaforo: {
      verde: semaforoMap['verde'] ?? 0,
      amarillo: semaforoMap['amarillo'] ?? 0,
      rojo: semaforoMap['rojo'] ?? 0,
    },
    riesgo: {
      bajo: riesgoMap['bajo'] ?? 0,
      medio: riesgoMap['medio'] ?? 0,
      alto: riesgoMap['alto'] ?? 0,
    },
    propuestas: Object.fromEntries(propuestasByEstado.map((p) => [p.estado, p._count._all])),
    proyectos: Object.fromEntries(proyectosByEtapa.map((p) => [p.etapa, p._count._all])),
    emails: { enviados: emailsEnviados30, recibidos: emailsRecibidos30, tasaRespuesta },
    reuniones: { pasadas: reunionesPasadas30, proximas: reunionesFuturas },
    seguimiento: Object.fromEntries(leadsBySegCount.map((s) => [`seg_${s.seguimientoCount}`, s._count._all])),
    timing: { diasHastaContacto: tiemposMedio },
    conversionPorSector,
    ultimasActividades: ultimasActividades.map((a) => ({
      tipo: a.tipo,
      descripcion: a.descripcion,
      lead: a.lead?.nombre,
      fecha: a.createdAt,
    })),
  })
}
