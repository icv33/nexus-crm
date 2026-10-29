import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFreshGoogleAccessToken } from '@/lib/google-token'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export const maxDuration = 60

const RESUMEN_EMAIL = process.env.ADMIN_EMAIL

async function sendResumenEmail(accessToken: string, resumen: string, fecha: string) {
  const subject = `Resumen Nexus — ${fecha}`
  const body = `Resumen ejecutivo diario de Nexus\n\n${resumen}\n\n---\nGenerado automáticamente por Nexus CRM`
  const lines = [
    `To: ${RESUMEN_EMAIL}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const isCron = req.headers.get('x-cron') === process.env.CRON_SECRET
    || req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!session && !isCron) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'TU_API_KEY_AQUI') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  const hoy = new Date()
  const inicioDia = startOfDay(hoy)
  const finDia = endOfDay(hoy)
  const ayer = startOfDay(subDays(hoy, 1))

  // Recopilar datos del día
  const [
    emailsEnviadosHoy,
    leadsNuevosHoy,
    actividadHoy,
    leadsInteresados,
    tareasPendientesAlta,
    propuestasPendientes,
    totalLeads,
    reunionesProximas,
    borradorsPendientes,
  ] = await Promise.all([
    prisma.email.count({ where: { tipo: 'enviado', fecha: { gte: inicioDia, lte: finDia } } }),
    prisma.lead.count({ where: { createdAt: { gte: ayer } } }),
    prisma.actividad.findMany({
      where: { createdAt: { gte: ayer } },
      include: { lead: { select: { nombre: true, estado: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.lead.findMany({
      where: { estado: { in: ['interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion'] } },
      select: { nombre: true, estado: true, sector: true, valorEstimado: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.tarea.findMany({
      where: { estado: 'pendiente', prioridad: 'alta' },
      include: { lead: { select: { nombre: true } } },
      take: 5,
    }),
    prisma.propuesta.count({ where: { estado: { in: ['pendiente_aprobacion', 'borrador'] } } }),
    prisma.lead.count(),
    prisma.reunion.findMany({
      where: { fechaInicio: { gte: hoy } },
      orderBy: { fechaInicio: 'asc' },
      take: 3,
    }),
    prisma.lead.findMany({
      where: { borradorRespuesta: { not: null } },
      select: { nombre: true },
    }),
  ])

  const contexto = `
DATOS DE HOY (${hoy.toLocaleDateString('es-ES')}):
- Emails enviados hoy: ${emailsEnviadosHoy}
- Leads nuevos (24h): ${leadsNuevosHoy}
- Total leads en sistema: ${totalLeads}
- Actividad reciente: ${actividadHoy.length} eventos

PIPELINE ACTIVO:
${leadsInteresados.map((l) => `- ${l.nombre} (${l.estado.replace(/_/g, ' ')})${l.valorEstimado ? ` → €${l.valorEstimado}` : ''}`).join('\n') || 'Sin leads en pipeline avanzado'}

TAREAS URGENTES:
${tareasPendientesAlta.map((t) => `- ${t.titulo}${t.lead ? ` [${t.lead.nombre}]` : ''}`).join('\n') || 'Sin tareas urgentes'}

PROPUESTAS PENDIENTES: ${propuestasPendientes}
REUNIONES PRÓXIMAS: ${reunionesProximas.length}
${borradorsPendientes.length > 0 ? `\n⚠️ RESPUESTAS PENDIENTES DE APROBACIÓN (${borradorsPendientes.length}): ${borradorsPendientes.map((l: any) => l.nombre).join(', ')}` : ''}
`

  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Eres el sistema de reporting de Nexus CRM. Tu trabajo es transcribir los datos del día en texto claro.

REGLA ABSOLUTA: Solo puedes mencionar información que aparezca LITERALMENTE en los datos de abajo. No inventes estrategias, análisis, interpretaciones ni acciones que no tengan base directa en los datos. Si no tienes el dato, no lo pongas.

${contexto}

FORMATO (solo texto plano, sin markdown, máximo 180 palabras):

NÚMEROS DEL DÍA
(lista solo los contadores que sean > 0: emails enviados, leads nuevos, total leads, actividades)

PIPELINE ACTIVO
(lista cada lead del pipeline con su estado exacto y valor si lo tiene. Si no hay leads, di "Sin leads en pipeline avanzado".)

PENDIENTES
(lista solo las tareas urgentes con nombre real del lead. Si hay borradores pendientes de aprobación, menciónalos con el nombre del lead. Si no hay nada, di "Sin pendientes urgentes".)

REUNIONES
(indica cuántas reuniones próximas hay. Si es 0, omite esta sección.)

No añadas valoraciones, recomendaciones estratégicas, ni frases motivadoras. Solo hechos del CRM.`,
    }],
  })

  const resumen = (msg.content[0] as any).text.trim()

  // Registrar en el agente
  const agente = await prisma.agente.findFirst({ where: { tipo: 'resumen_diario' } })
  if (agente) {
    await prisma.agenteLog.create({
      data: {
        agenteId: agente.id,
        mensaje: 'Resumen diario generado',
        metadata: { emailsEnviadosHoy, leadsNuevosHoy, leadsInteresados: leadsInteresados.length } as any,
      },
    })
    await prisma.agente.update({
      where: { id: agente.id },
      data: { ultimaEjecucion: new Date() },
    })
  }

  // Enviar resumen por email solo cuando lo llama el cron (no cuando el usuario lo pulsa manualmente)
  let emailEnviado = false
  if (isCron) {
    try {
      const accessToken = await getFreshGoogleAccessToken()
      if (accessToken) {
        await sendResumenEmail(accessToken, resumen, hoy.toLocaleDateString('es-ES'))
        emailEnviado = true
      }
    } catch { /* no bloquear si falla el envío */ }
  }

  return NextResponse.json({ ok: true, resumen, emailEnviado, datos: { emailsEnviadosHoy, leadsNuevosHoy, leadsInteresados: leadsInteresados.length, tareasPendientesAlta: tareasPendientesAlta.length, propuestasPendientes } })
}
