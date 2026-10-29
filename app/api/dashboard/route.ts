import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const hoy = new Date()
  const inicioDia = startOfDay(hoy)
  const finDia = endOfDay(hoy)

  const [
    leadsNuevos,
    leadsAnalizados,
    leadsInteresados,
    correosEnviadosHoy,
    correosPreparados,
    respuestasRecibidas,
    reunionesAgendadas,
    propuestasPendientes,
    proyectosActivos,
    tareasPendientes,
    pipeline,
    actividadReciente,
    tareasPrioritarias,
    ingresos,
    agentes,
    altaPrioridadSinEmail,
    totalContactados,
    totalRespondidos,
    totalGanados,
    borradorsPendientes,
  ] = await Promise.all([
    prisma.lead.count({ where: { estado: 'nuevo' } }),
    prisma.lead.count({ where: { estado: 'analizado' } }),
    prisma.lead.count({ where: { estado: { in: ['interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion'] } } }),
    prisma.email.count({ where: { tipo: 'enviado', fecha: { gte: inicioDia, lte: finDia } } }),
    prisma.lead.count({ where: { email: { not: null }, emailEnviado: false } }),
    prisma.lead.count({ where: { estado: 'respondio' } }),
    prisma.reunion.count({ where: { fechaInicio: { gte: hoy } } }),
    prisma.propuesta.count({ where: { estado: { in: ['pendiente_aprobacion', 'borrador'] } } }),
    prisma.proyecto.count({ where: { estado: 'activo' } }),
    prisma.tarea.count({ where: { estado: 'pendiente' } }),
    prisma.lead.groupBy({
      by: ['estado'],
      _count: { _all: true },
      where: { estado: { in: ['nuevo', 'contactado', 'respondio', 'interesado', 'reunion_agendada', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'] } },
    }),
    prisma.actividad.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { lead: { select: { id: true, nombre: true } } },
    }),
    prisma.tarea.findMany({
      where: { estado: { in: ['pendiente', 'en_progreso'] }, prioridad: 'alta' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { lead: { select: { id: true, nombre: true } } },
    }),
    prisma.lead.aggregate({
      _sum: { valorEstimado: true },
      where: { estado: { in: ['ganado', 'negociacion', 'propuesta_enviada'] } },
    }),
    prisma.agente.findMany({ orderBy: { nombre: 'asc' }, take: 6 }),
    prisma.lead.findMany({
      where: { prioridad: 'alta', email: null, telefono: { not: null }, estado: { notIn: ['descartado', 'perdido', 'ganado'] } },
      select: { id: true, nombre: true, sector: true, ciudad: true, puntuacion: true, telefono: true, web: true, email: true },
      orderBy: { puntuacion: 'desc' },
      take: 10,
    }),
    prisma.lead.count({ where: { emailEnviado: true } }),
    prisma.lead.count({ where: { estado: { in: ['respondio', 'interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion', 'ganado'] } } }),
    prisma.lead.count({ where: { estado: 'ganado' } }),
    prisma.lead.findMany({
      where: { borradorRespuesta: { not: null } },
      select: { id: true, nombre: true },
      orderBy: { ultimoContactoEn: 'desc' },
    }),
  ])

  const mrr = (ingresos._sum.valorEstimado ?? 0) / 12
  const tasaRespuesta = totalContactados > 0 ? Math.round((totalRespondidos / totalContactados) * 100) : 0
  const tasaConversion = totalContactados > 0 ? Math.round((totalGanados / totalContactados) * 100) : 0

  return NextResponse.json({
    stats: {
      leadsNuevos,
      leadsAnalizados,
      leadsInteresados,
      correosEnviadosHoy,
      correosPreparados,
      respuestasRecibidas,
      reunionesAgendadas,
      propuestasPendientes,
      proyectosActivos,
      tareasPendientes,
      ingresosEstimados: ingresos._sum.valorEstimado ?? 0,
      mrr: Math.round(mrr),
      tasaRespuesta,
      tasaConversion,
      totalContactados,
      totalGanados,
    },
    pipeline,
    actividadReciente,
    tareasPrioritarias,
    agentes,
    altaPrioridadSinEmail,
    borradorsPendientes,
  })
}
