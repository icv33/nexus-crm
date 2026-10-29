import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { subDays } from 'date-fns'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const hace7dias = subDays(new Date(), 7)

  const [
    totalLeads,
    leadsByEstado,
    leadsBySector,
    leadsByCity,
    leadsRecientes,
    leadsGanados,
    scoresBySector,
    interesadosGanados,
    altaPrioridadSinContactar,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ['sector'],
      _count: { _all: true },
      _avg: { puntuacion: true },
      orderBy: { _count: { sector: 'desc' } },
      take: 12,
      where: { sector: { not: null } },
    }),
    prisma.lead.groupBy({
      by: ['ciudad'],
      _count: { _all: true },
      orderBy: { _count: { ciudad: 'desc' } },
      take: 8,
    }),
    prisma.lead.count({ where: { createdAt: { gte: hace7dias } } }),
    prisma.lead.findMany({
      where: { estado: 'ganado' },
      select: { sector: true, valorEstimado: true },
    }),
    prisma.lead.groupBy({
      by: ['sector'],
      _avg: { puntuacion: true },
      _count: { _all: true },
      orderBy: { _avg: { puntuacion: 'desc' } },
      take: 10,
      where: { sector: { not: null } },
    }),
    prisma.lead.groupBy({
      by: ['sector'],
      _count: { _all: true },
      where: {
        estado: { in: ['interesado', 'ganado', 'negociacion', 'propuesta_enviada', 'reunion_agendada'] },
        sector: { not: null },
      },
    }),
    prisma.lead.count({
      where: { prioridad: 'alta', email: null, estado: { notIn: ['descartado', 'perdido', 'ganado'] } },
    }),
  ])

  // Build conversion rates
  const sectorInterest: Record<string, number> = {}
  interesadosGanados.forEach((s) => { if (s.sector) sectorInterest[s.sector] = s._count._all })

  const conversionRates = leadsBySector
    .filter((s) => s.sector && s._count._all >= 2)
    .map((s) => ({
      sector: s.sector!,
      total: s._count._all,
      interesados: sectorInterest[s.sector!] ?? 0,
      tasa: Math.round(((sectorInterest[s.sector!] ?? 0) / s._count._all) * 100),
      scorePromedio: Math.round((s._avg.puntuacion ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.tasa - a.tasa)

  const gananciasPorSector: Record<string, number> = {}
  leadsGanados.forEach((l) => {
    if (l.sector) gananciasPorSector[l.sector] = (gananciasPorSector[l.sector] ?? 0) + (l.valorEstimado ?? 0)
  })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Eres estratega comercial de Nexus Digital (agencia de automatización/IA para negocios locales en España). Analiza estos datos reales del CRM y genera oportunidades estratégicas accionables.

DATOS DEL CRM:
- Total leads: ${totalLeads} | Nuevos esta semana: ${leadsRecientes}
- Leads sin email (alta prioridad): ${altaPrioridadSinContactar}
- Estados: ${JSON.stringify(leadsByEstado.map((e) => ({ estado: e.estado, n: e._count._all })))}

CONVERSIÓN POR SECTOR (top):
${conversionRates.slice(0, 6).map((s) => `${s.sector}: ${s.total} leads, ${s.interesados} interesados (${s.tasa}% conversión), score medio ${s.scorePromedio}`).join('\n')}

TOP CIUDADES:
${leadsByCity.slice(0, 5).map((c) => `${c.ciudad}: ${c._count._all} leads`).join(', ')}

GANANCIAS POR SECTOR:
${Object.entries(gananciasPorSector).map(([s, v]) => `${s}: ${v}€`).join(', ') || 'Sin datos de ganancias aún'}

Genera 4 oportunidades estratégicas ESPECÍFICAS basadas en estos datos.

Devuelve SOLO JSON:
{
  "resumen_mercado": "una frase describiendo el estado actual y el mayor problema/oportunidad",
  "oportunidades": [
    {
      "titulo": "nombre de la oportunidad (5-7 palabras)",
      "descripcion": "qué hacer específicamente y por qué los datos lo indican",
      "accion_inmediata": "primera acción concreta a ejecutar hoy o mañana",
      "impacto_estimado": "qué resultado esperar si se ejecuta",
      "impacto": "alto|medio",
      "tipo": "prospección|conversión|retención|expansión"
    }
  ]
}`,
    }],
  })

  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const resultado = JSON.parse(jsonMatch?.[0] ?? text)
    return NextResponse.json({
      ok: true,
      ...resultado,
      datos: {
        totalLeads,
        leadsRecientes,
        conversionRates: conversionRates.slice(0, 6),
        topCiudades: leadsByCity.slice(0, 5),
        altaPrioridadSinContactar,
        gananciasPorSector,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al generar análisis de oportunidades' }, { status: 500 })
  }
}
