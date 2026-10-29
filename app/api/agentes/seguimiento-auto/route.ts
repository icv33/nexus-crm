import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { subDays } from 'date-fns'
import { randomUUID } from 'crypto'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://nexus-plum-tau.vercel.app'

function dentroVentanaHoraria(): boolean {
  const hora = parseInt(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(new Date()))
  return hora >= 9 && hora < 18
}

const MAX_EMAILS_POR_LEAD = 3

const SECTOR_VALOR: Record<string, string> = {
  restaurante:  'sistema de reservas online que evita llamadas y reduce no-shows hasta un 40%',
  bar:          'carta digital QR y pedidos en mesa que reducen tiempos de espera',
  peluquería:   'citas online 24/7 que llenan la agenda sin que suene el teléfono',
  clínica:      'recordatorios automáticos de cita que reducen ausencias hasta un 30%',
  dentista:     'recordatorios automáticos de cita que reducen ausencias hasta un 30%',
  gimnasio:     'automatización de altas y bajas de socios sin papeles ni llamadas',
  hotel:        'sistema de reservas directas que evita comisiones de Booking y Airbnb',
  farmacia:     'catálogo digital y pedidos anticipados que agilizan la atención',
  fontanero:    'formulario de presupuesto online disponible 24/7 para captar más clientes',
  abogado:      'captación de consultas online con formulario de intake automatizado',
  academia:     'inscripciones y pagos online que eliminan gestión administrativa manual',
  tienda:       'tienda online integrada con el stock físico para vender también por internet',
  veterinario:  'recordatorios de vacunas y citas que fidelizan a los dueños de mascotas',
}

function getSectorValor(sector?: string | null): string {
  if (!sector) return 'automatización de procesos repetitivos que ahorra tiempo cada día'
  const key = sector.toLowerCase().trim()
  for (const [k, v] of Object.entries(SECTOR_VALOR)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return 'automatización que libera tiempo para centrarse en lo importante del negocio'
}

async function generarSeguimiento(lead: any, emailCount: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const esUltimo = emailCount >= MAX_EMAILS_POR_LEAD - 1
  const valorSector = getSectorValor(lead.sector)
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Escribe un email de seguimiento para un negocio que no ha respondido.

NEGOCIO: ${lead.nombre} (${lead.sector ?? 'N/A'}, ${lead.ciudad ?? 'N/A'})
PROBLEMA DETECTADO: ${lead.problemaDetectado ?? 'presencia digital mejorable'}
VALOR CONCRETO PARA SU SECTOR: ${valorSector}
SEGUIMIENTO Nº: ${emailCount} de ${MAX_EMAILS_POR_LEAD - 1}
${esUltimo ? 'Este es el ÚLTIMO intento. Sé breve, sin presión, deja la puerta abierta con elegancia.' : 'Menciona el valor concreto del sector como gancho principal. No repitas el primer email.'}

REGLAS ESTRICTAS:
- Máximo 70 palabras
- No seas insistente ni desesperado
- Usa el VALOR CONCRETO DEL SECTOR como argumento central
- Firma como: Ignacio, Nexus Digital
- SOLO el texto del email, sin asunto, sin markdown, sin comillas`,
    }],
  })
  return (msg.content[0] as any).text.trim()
}

async function enviarSeguimiento(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  leadId: string,
  threadId?: string | null,
) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const trackingId = randomUUID()
  const pixelUrl = `${APP_URL}/api/track/open?id=${trackingId}`
  const htmlContent = body
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:600px">${htmlContent}<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden" alt="" /></body></html>`

  const boundary = `nexus_${Date.now()}`
  const headerLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ...(threadId ? [`In-Reply-To: ${threadId}`, `References: ${threadId}`] : []),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ]
  const raw = Buffer.from(headerLines.join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  })

  await prisma.email.create({
    data: {
      leadId,
      gmailMessageId: res.data.id ?? undefined,
      gmailThreadId: res.data.threadId ?? threadId ?? undefined,
      tipo: 'enviado',
      asunto: subject,
      cuerpo: body,
      destinatario: to,
      fecha: new Date(),
      trackingId,
    },
  })
  await prisma.lead.update({
    where: { id: leadId },
    data: { ultimoContactoEn: new Date() },
  })
  await prisma.actividad.create({
    data: { tipo: 'email_enviado', descripcion: `Seguimiento automático enviado a ${to}`, leadId },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const isCron = req.headers.get('x-cron') === process.env.CRON_SECRET
  if (!session && !isCron) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken ?? req.headers.get('x-google-token')
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible.' }, { status: 401 })

  if (!dentroVentanaHoraria()) {
    return NextResponse.json({ ok: true, enviados: [], omitidos: ['Fuera de ventana horaria (9-18h Madrid)'], total: 0 })
  }

  const fechaLimite = subDays(new Date(), 3)

  const leads = await prisma.lead.findMany({
    where: {
      estado: { in: ['contactado', 'seguimiento_1', 'seguimiento_2'] },
      emailEnviado: true,
      email: { not: null },
      ultimoContactoEn: { lt: fechaLimite },
      semaforo: { not: 'rojo' },
    },
    include: {
      emails: {
        where: { tipo: 'enviado' },
        orderBy: { fecha: 'asc' },
      },
    },
    orderBy: { puntuacion: 'desc' },
    take: 5,
  })

  const enviados: string[] = []
  const omitidos: string[] = []

  for (const lead of leads) {
    const emailCount = lead.emails.length

    if (emailCount >= MAX_EMAILS_POR_LEAD) {
      omitidos.push(`${lead.nombre} (máx emails alcanzado)`)
      continue
    }

    try {
      const body = await generarSeguimiento(lead, emailCount)
      const isUltimo = emailCount >= MAX_EMAILS_POR_LEAD - 1
      const subject = isUltimo
        ? `Re: ${lead.nombre} — último mensaje de Nexus Digital`
        : `Re: ¿Llegó mi mensaje? — ${lead.nombre}`

      const lastEmail = lead.emails[lead.emails.length - 1]
      await enviarSeguimiento(
        accessToken,
        lead.email!,
        subject,
        body,
        lead.id,
        lastEmail?.gmailThreadId,
      )

      const nuevoEstado =
        emailCount === 1 ? 'seguimiento_1' :
        emailCount === 2 ? 'seguimiento_2' :
        'seguimiento_3'

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          estado: nuevoEstado as any,
          seguimientoCount: { increment: 1 },
        },
      })
      await prisma.actividad.create({
        data: {
          tipo: 'estado_cambiado',
          descripcion: `Estado actualizado a ${nuevoEstado} tras seguimiento automático`,
          leadId: lead.id,
        },
      })

      enviados.push(`${lead.nombre} → ${nuevoEstado}`)
      await new Promise((r) => setTimeout(r, 1500))
    } catch (e: any) {
      omitidos.push(`${lead.nombre}: ${e.message}`)
    }
  }

  await prisma.agente.updateMany({
    where: { tipo: 'seguimiento' },
    data: { ultimaEjecucion: new Date(), estado: 'activo' },
  })

  return NextResponse.json({ ok: true, enviados, omitidos, total: leads.length })
}
