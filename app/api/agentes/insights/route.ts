import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { subDays } from 'date-fns'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const hace30dias = subDays(new Date(), 30)
  const hace7dias = subDays(new Date(), 7)
  const hace14dias = subDays(new Date(), 14)

  const [
    totalLeads,
    leadsByEstado,
    leadsBySector,
    leadsByCity,
    emailsSentTotal,
    emailsReceivedTotal,
    emailsSentMonth,
    emailsReceivedMonth,
    leadsGanados,
    leadsEstaSemana,
    leadsSemanaPasada,
    topLeadsSinConverir,
    avgScore,
    propuestasPendientes,
    proyectosActivos,
    tareasAlta,
    leadsConEmail,
    totalLeadsSinEmail,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ['sector'],
      _count: { _all: true },
      _avg: { puntuacion: true },
      where: { sector: { not: null } },
      orderBy: { _count: { sector: 'desc' } },
      take: 8,
    }),
    prisma.lead.groupBy({
      by: ['ciudad'],
      _count: { _all: true },
      orderBy: { _count: { ciudad: 'desc' } },
      take: 5,
    }),
    prisma.email.count({ where: { tipo: 'enviado' } }),
    prisma.email.count({ where: { tipo: 'recibido' } }),
    prisma.email.count({ where: { tipo: 'enviado', fecha: { gte: hace30dias } } }),
    prisma.email.count({ where: { tipo: 'recibido', fecha: { gte: hace30dias } } }),
    prisma.lead.findMany({
      where: { estado: 'ganado' },
      select: { sector: true, valorEstimado: true, createdAt: true },
    }),
    prisma.lead.count({ where: { createdAt: { gte: hace7dias } } }),
    prisma.lead.count({ where: { createdAt: { gte: hace14dias, lt: hace7dias } } }),
    prisma.lead.findMany({
      where: { puntuacion: { gte: 7 }, estado: { notIn: ['descartado', 'perdido', 'ganado'] } },
      orderBy: { puntuacion: 'desc' },
      take: 5,
      select: { nombre: true, sector: true, estado: true, puntuacion: true, email: true },
    }),
    prisma.lead.aggregate({ _avg: { puntuacion: true } }),
    prisma.propuesta.count({ where: { estado: { in: ['borrador', 'pendiente_aprobacion'] } } }),
    prisma.proyecto.count({ where: { estado: 'activo' } }),
    prisma.tarea.count({ where: { estado: { in: ['pendiente', 'en_progreso'] }, prioridad: 'alta' } }),
    prisma.lead.count({ where: { email: { not: null } } }),
    prisma.lead.count({ where: { email: null } }),
  ])

  const totalValorGanado = leadsGanados.reduce((sum, l) => sum + (l.valorEstimado ?? 0), 0)
  const responseRateMonth = emailsSentMonth > 0 ? Math.round((emailsReceivedMonth / emailsSentMonth) * 100) : 0
  const responseRateTotal = emailsSentTotal > 0 ? Math.round((emailsReceivedTotal / emailsSentTotal) * 100) : 0
  const conversionRate = totalLeads > 0 ? Math.round((leadsGanados.length / totalLeads) * 100) : 0
  const leadsEnPipeline = leadsByEstado
    .filter((l) => ['interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion'].includes(l.estado))
    .reduce((sum, l) => sum + l._count._all, 0)
  const crecimientoSemanal = leadsSemanaPasada > 0
    ? Math.round(((leadsEstaSemana - leadsSemanaPasada) / leadsSemanaPasada) * 100)
    : leadsEstaSemana > 0 ? 100 : 0

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Eres analista de negocio de Nexus Digital. Genera un análisis estratégico profundo basado en datos reales del CRM.

MÉTRICAS CLAVE:
- Total leads: ${totalLeads} (${leadsConEmail} con email, ${totalLeadsSinEmail} sin email)
- Crecimiento: +${leadsEstaSemana} esta semana vs +${leadsSemanaPasada} semana anterior (${crecimientoSemanal > 0 ? '+' : ''}${crecimientoSemanal}%)
- Pipeline activo: ${leadsEnPipeline} leads
- Tasa de respuesta (30 días): ${responseRateMonth}% | Total: ${responseRateTotal}%
- Conversión total: ${conversionRate}% (${leadsGanados.length} ganados)
- Valor total ganado: ${totalValorGanado}€
- Score promedio leads: ${avgScore._avg.puntuacion?.toFixed(1) ?? 'N/A'}/10
- Propuestas pendientes: ${propuestasPendientes}
- Proyectos activos: ${proyectosActivos}
- Tareas urgentes sin completar: ${tareasAlta}

TOP SECTORES (volumen):
${leadsBySector.slice(0, 5).map((s) => `${s.sector}: ${s._count._all} leads, score medio ${s._avg.puntuacion?.toFixed(1) ?? 'N/A'}`).join('\n')}

LEADS PREMIUM SIN CONVERTIR (score≥7):
${topLeadsSinConverir.map((l) => `${l.nombre} (${l.estado}, ${l.puntuacion}/10${l.email ? ', ✓email' : ', sin email'})`).join('\n') || 'Ninguno'}

Estados del pipeline: ${JSON.stringify(leadsByEstado.map((e) => `${e.estado}:${e._count._all}`).join(', '))}

Genera un análisis HONESTO y ESPECÍFICO basado exactamente en estos datos.

Devuelve SOLO JSON:
{
  "puntuacion_salud": número del 1-100 (salud del negocio basada en métricas),
  "tendencia": "creciendo|estable|bajando",
  "resumen_ejecutivo": "2-3 frases sobre el estado real del negocio",
  "fortalezas": [
    { "titulo": "nombre de la fortaleza", "dato": "métrica concreta que la respalda" }
  ],
  "debilidades": [
    { "titulo": "nombre del problema", "dato": "métrica que lo indica", "urgencia": "alta|media" }
  ],
  "acciones_prioritarias": [
    {
      "accion": "qué hacer exactamente",
      "justificacion": "dato específico que lo justifica",
      "impacto": "resultado esperado",
      "prioridad": "alta|media"
    }
  ]
}
Máx 3 fortalezas, 3 debilidades, 3 acciones. Sé directo y usa los datos reales.`,
    }],
  })

  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const insights = JSON.parse(jsonMatch?.[0] ?? text)
    return NextResponse.json({
      ok: true,
      insights,
      metricas: {
        totalLeads, leadsEstaSemana, leadsSemanaPasada, crecimientoSemanal,
        leadsEnPipeline, responseRateMonth, responseRateTotal,
        conversionRate, totalValorGanado, leadsGanados: leadsGanados.length,
        propuestasPendientes, proyectosActivos, tareasAlta,
        avgScore: avgScore._avg.puntuacion,
        topSectores: leadsBySector.slice(0, 5),
        topCiudades: leadsByCity.slice(0, 5),
        topLeadsSinConverir,
        leadsConEmail, totalLeadsSinEmail,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al generar insights' }, { status: 500 })
  }
}
