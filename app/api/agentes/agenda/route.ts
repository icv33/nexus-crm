import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { addDays, addHours, setHours, setMinutes, format, isBefore, isAfter } from 'date-fns'

const MEETING_DURATION_MINUTES = 45
const DAYS_AHEAD = 7
const WORK_HOURS_START = 9
const WORK_HOURS_END = 18

async function getCalendarBusySlots(auth: any, from: Date, to: Date): Promise<Array<{ start: string; end: string }>> {
  const calendar = google.calendar({ version: 'v3', auth })
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: 'primary' }],
    },
  })
  const busy = res.data.calendars?.primary?.busy ?? []
  return busy.filter((b): b is { start: string; end: string } =>
    typeof b.start === 'string' && typeof b.end === 'string'
  )
}

function generateCandidateSlots(from: Date, days: number): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = []
  for (let d = 1; d <= days; d++) {
    const day = addDays(from, d)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue
    for (let h = WORK_HOURS_START; h < WORK_HOURS_END - 1; h += 2) {
      const start = setMinutes(setHours(new Date(day), h), 0)
      const end = addHours(start, 1)
      slots.push({ start, end })
    }
  }
  return slots
}

function filterFreeSlots(
  candidates: Array<{ start: Date; end: Date }>,
  busy: Array<{ start: string; end: string }>,
  limit = 3,
): Array<{ start: Date; end: Date }> {
  return candidates
    .filter(({ start, end }) => {
      return !busy.some((b) => {
        const bs = new Date(b.start)
        const be = new Date(b.end)
        return isBefore(start, be) && isAfter(end, bs)
      })
    })
    .slice(0, limit)
}

async function createCalendarEvent(
  auth: any,
  slot: { start: Date; end: Date },
  lead: any,
): Promise<{ eventId: string; meetLink: string }> {
  const calendar = google.calendar({ version: 'v3', auth })
  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: `Reunión con ${lead.nombre} — Nexus Digital`,
      description: `Lead: ${lead.nombre}\nSector: ${lead.sector ?? 'N/A'}\nEmail: ${lead.email ?? 'N/A'}\n\nReunión agendada automáticamente por Nexus Digital`,
      start: { dateTime: slot.start.toISOString(), timeZone: 'Europe/Madrid' },
      end: { dateTime: slot.end.toISOString(), timeZone: 'Europe/Madrid' },
      attendees: lead.email ? [{ email: lead.email }] : [],
      conferenceData: {
        createRequest: {
          requestId: `nexus-${lead.id}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  const meetLink = res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? ''
  return { eventId: res.data.id!, meetLink }
}

async function detectMeetingIntent(emailBody: string): Promise<{ tiene: boolean; preferencia?: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Analiza si este email expresa intención de tener una reunión/llamada/videoconferencia.

EMAIL: "${emailBody.slice(0, 500)}"

Responde SOLO JSON:
{"tiene": true|false, "preferencia": "mañana|tarde|null", "urgencia": "alta|media|baja"}`,
    }],
  })
  try {
    const text = (msg.content[0] as any).text.trim()
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
    return { tiene: json.tiene === true, preferencia: json.preferencia }
  } catch {
    return { tiene: false }
  }
}

// POST /api/agentes/agenda
// body: { leadId, emailBody? } — agenda reunión para un lead
// body: { scanUnread: true } — escanea emails con intención de reunión y agenda automáticamente
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const isCron = req.headers.get('x-cron') === process.env.CRON_SECRET
  if (!session && !isCron) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken ?? req.headers.get('x-google-token')
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const now = new Date()
  const rangeEnd = addDays(now, DAYS_AHEAD)

  // ── Modo: agendar reunión para un lead específico ─────────────────────────
  if (body.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    const emailBody: string = body.emailBody ?? lead.resumenRespuesta ?? ''
    const intent = emailBody ? await detectMeetingIntent(emailBody) : { tiene: true }
    if (!intent.tiene) return NextResponse.json({ ok: false, razon: 'No se detectó intención de reunión' })

    const busySlots = await getCalendarBusySlots(auth, now, rangeEnd)
    const candidates = generateCandidateSlots(now, DAYS_AHEAD)
    const freeSlots = filterFreeSlots(candidates, busySlots, 3)

    if (freeSlots.length === 0) {
      return NextResponse.json({ ok: false, razon: 'No hay huecos disponibles en los próximos días' })
    }

    const chosen = freeSlots[0]
    const { eventId, meetLink } = await createCalendarEvent(auth, chosen, lead)

    const reunion = await prisma.reunion.create({
      data: {
        leadId: lead.id,
        googleEventId: eventId,
        titulo: `Reunión con ${lead.nombre}`,
        descripcion: `Agendada automáticamente por el agente de agenda`,
        fechaInicio: chosen.start,
        fechaFin: chosen.end,
        enlaceMeet: meetLink,
        estado: 'confirmada',
      },
    })

    await prisma.lead.update({
      where: { id: lead.id },
      data: { estado: 'reunion_agendada', proximaAccion: `Reunión el ${format(chosen.start, 'dd/MM/yyyy HH:mm')}` },
    })

    await prisma.actividad.create({
      data: {
        tipo: 'reunion_agendada',
        descripcion: `Reunión agendada con ${lead.nombre} para el ${format(chosen.start, 'dd/MM/yyyy HH:mm')}`,
        leadId: lead.id,
        metadata: { eventId, meetLink, slot: chosen.start.toISOString() },
      },
    })

    return NextResponse.json({
      ok: true,
      reunion: { id: reunion.id, fecha: chosen.start, meetLink, eventId },
      slotsPropuestos: freeSlots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    })
  }

  // ── Modo: escanear tareas CEO con intención de reunión ────────────────────
  if (body.scanTareas) {
    const tareas = await prisma.tarea.findMany({
      where: {
        tipo: 'accion',
        estado: 'pendiente',
        titulo: { contains: 'reunion' },
        leadId: { not: null },
      },
      include: { lead: true },
      take: 5,
    })

    const agendadas: string[] = []
    const errores: string[] = []

    for (const tarea of tareas) {
      if (!tarea.lead || !tarea.lead.email) continue
      try {
        const busySlots = await getCalendarBusySlots(auth, now, rangeEnd)
        const candidates = generateCandidateSlots(now, DAYS_AHEAD)
        const freeSlots = filterFreeSlots(candidates, busySlots, 1)
        if (freeSlots.length === 0) { errores.push(`${tarea.lead.nombre}: sin huecos`); continue }

        const chosen = freeSlots[0]
        const { eventId, meetLink } = await createCalendarEvent(auth, chosen, tarea.lead)

        await prisma.reunion.create({
          data: {
            leadId: tarea.lead.id,
            googleEventId: eventId,
            titulo: `Reunión con ${tarea.lead.nombre}`,
            descripcion: tarea.descripcion ?? '',
            fechaInicio: chosen.start,
            fechaFin: chosen.end,
            enlaceMeet: meetLink,
            estado: 'confirmada',
          },
        })

        await prisma.lead.update({
          where: { id: tarea.lead.id },
          data: { estado: 'reunion_agendada', proximaAccion: `Reunión el ${format(chosen.start, 'dd/MM/yyyy HH:mm')}` },
        })

        await prisma.tarea.update({ where: { id: tarea.id }, data: { estado: 'completada' } })

        await prisma.actividad.create({
          data: {
            tipo: 'reunion_agendada',
            descripcion: `Reunión agendada automáticamente con ${tarea.lead.nombre}`,
            leadId: tarea.lead.id,
            metadata: { eventId, meetLink },
          },
        })

        agendadas.push(`${tarea.lead.nombre} → ${format(chosen.start, 'dd/MM HH:mm')}`)
      } catch (e: any) {
        errores.push(`${tarea.lead.nombre}: ${e.message}`)
      }
    }

    await prisma.agente.updateMany({
      where: { tipo: 'calendario' },
      data: { ultimaEjecucion: new Date(), estado: 'activo' },
    })

    return NextResponse.json({ ok: true, agendadas, errores })
  }

  return NextResponse.json({ error: 'Parámetros inválidos. Usa leadId o scanTareas.' }, { status: 400 })
}

// GET /api/agentes/agenda — próximas reuniones del calendario
export async function GET() {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible' }, { status: 401 })

  const now = new Date()
  const rangeEnd = addDays(now, 14)

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth })

  const [calRes, reuniones] = await Promise.all([
    calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: rangeEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    }),
    prisma.reunion.findMany({
      where: { fechaInicio: { gte: now } },
      include: { lead: { select: { nombre: true, sector: true, email: true } } },
      orderBy: { fechaInicio: 'asc' },
      take: 10,
    }),
  ])

  return NextResponse.json({
    ok: true,
    eventosCalendario: calRes.data.items ?? [],
    reunionesDB: reuniones,
  })
}
