import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

// ─── Configuración ────────────────────────────────────────────────────────────

async function getPriceThreshold(): Promise<number> {
  const cfg = await prisma.configuracion.findUnique({ where: { clave: 'price_approval_threshold' } })
  return parseInt(cfg?.valor ?? '500')
}

// ─── Detección de rebotes ─────────────────────────────────────────────────────

function isBounce(from: string, subject: string, body?: string): boolean {
  const f = from.toLowerCase()
  const s = subject.toLowerCase()
  const b = (body ?? '').toLowerCase().substring(0, 800)

  // Remitente típico de rebote
  if (
    f.includes('mailer-daemon') || f.includes('postmaster') || f.includes('mail delivery') ||
    f.includes('noreply') || f.includes('no-reply') || f.includes('no_reply') ||
    f.includes('daemon') || f.includes('bounce') || f.includes('bounced')
  ) return true

  // Asunto de rebote (ES + EN)
  const bounceSubjects = [
    'delivery status notification', 'undeliverable', 'mail delivery failed',
    'failed to deliver', 'address not found', 'delivery failure',
    'no se ha encontrado el usuario', 'dirección no encontrada',
    'correo electrónico no enviado', 'no se pudo entregar', 'mensaje no entregado',
    'entrega fallida', 'entrega no realizada', 'error de entrega',
    'returned mail', 'return to sender', 'message not delivered',
    'permanent failure', 'recipient rejected', 'user unknown',
    'no such user', 'mailbox not found', 'buzón no encontrado',
  ]
  if (bounceSubjects.some((p) => s.includes(p))) return true

  // Cuerpo con señales inequívocas de rebote
  const bounceBody = [
    'smtp error', '550 ', '551 ', '552 ', '553 ', '554 ',
    'user does not exist', 'account does not exist', 'no existe la cuenta',
    'la dirección de correo electrónico no existe',
    'the email account that you tried to reach does not exist',
    'we were unable to deliver', 'delivery to the following recipient failed',
    'this message was created automatically', 'technical details of permanent failure',
  ]
  if (bounceBody.some((p) => b.includes(p))) return true

  return false
}

// ─── Detección de auto-respuestas ────────────────────────────────────────────

function isAutoReply(headers: { name?: string | null; value?: string | null }[], subject: string, body: string): boolean {
  // Cabeceras estándar de auto-respuesta
  const autoSubmitted = headers.find((h) => h.name?.toLowerCase() === 'auto-submitted')?.value ?? ''
  const precedence = headers.find((h) => h.name?.toLowerCase() === 'precedence')?.value ?? ''
  const xAutoResponse = headers.find((h) => h.name?.toLowerCase() === 'x-auto-response-suppress')?.value ?? ''
  if (autoSubmitted && autoSubmitted !== 'no') return true
  if (precedence.toLowerCase().includes('auto_reply') || precedence.toLowerCase().includes('bulk')) return true
  if (xAutoResponse) return true

  const s = subject.toLowerCase()
  const b = body.toLowerCase().substring(0, 500)

  const subjectPatterns = [
    'fuera de oficina', 'out of office', 'auto-respuesta', 'respuesta automática',
    'automatic reply', 'autoreply', 'auto reply', 'vacation', 'vacaciones',
    'ausente', 'no disponible', 'away from the office',
  ]
  if (subjectPatterns.some((p) => s.includes(p))) return true

  const bodyPatterns = [
    'responderemos en breve', 'responderemos lo antes posible', 'nos pondremos en contacto',
    'hemos recibido tu correo', 'hemos recibido tu mensaje', 'we have received your email',
    'we will get back to you', "we'll get back to you", 'we will respond within',
    'thank you for contacting', 'gracias por contactar', 'gracias por escribir',
    'este es un mensaje automático', 'this is an automatic reply', 'este correo es automático',
    'nuestro horario de atención', 'nuestro horario comercial', 'en horario de oficina',
    'outside of business hours', 'fuera de nuestro horario',
  ]
  if (bodyPatterns.some((p) => b.includes(p))) return true

  return false
}

function stripQuotedReply(text: string): string {
  const separators = [
    /\n\nEl .{1,120}escribi[oó]:\s*\n/,
    /\n\nOn .{1,120}wrote:\s*\n/,
    /\n\n-{3,}[\s\S]*?Mensaje original[\s\S]*?-{3,}/i,
    /\n\n-{3,}[\s\S]*?Original Message[\s\S]*?-{3,}/i,
    /\n\nDe:[\s\S]*?\nPara:/,
    /\n\nFrom:[\s\S]*?\nTo:/,
  ]
  let result = text
  for (const sep of separators) {
    const idx = result.search(sep)
    if (idx !== -1) { result = result.substring(0, idx); break }
  }
  return result.trim()
}

function extractBouncedEmail(body: string): string | null {
  const patterns = [
    /(?:final.recipient|original.recipient|to|para)[:\s]+<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/i,
    /(?:no se ha encontrado el usuario|address not found|user unknown)[:\s]+<?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>?/i,
  ]
  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match?.[1]) return match[1].toLowerCase()
  }
  const allEmails = body.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? []
  return allEmails.find((e) => !e.includes('google') && !e.includes('mailer-daemon') && !e.includes('postmaster')) ?? null
}

// ─── Sistema de Semáforo ──────────────────────────────────────────────────────
// Clasificación rápida sin IA (filtro previo para reducir llamadas a Claude)

const KEYWORDS_ROJO = [
  'descuento', 'rebaja', 'precio cerrado', 'precio final', 'precio máximo',
  'contrato', 'acuerdo legal', 'penalización', 'garantía de devolución',
  'no me interesa', 'no estoy interesado', 'paso', 'no gracias',
  'demanda', 'legal', 'abogado', 'denunciar',
]

const KEYWORDS_AMARILLO = [
  'precio', 'coste', 'presupuesto', 'tarifa', 'cuánto cuesta', 'cuánto cobráis',
  'cuánto vale', 'inversión', 'pago', 'factura', 'euros', '€',
  'cuánto tiempo', 'plazo', 'fecha límite', 'urgente', 'antes del',
  'condiciones especiales', 'plan personalizado',
]

function preClassifySemaforo(text: string): 'rojo' | 'amarillo' | 'verde' {
  const lower = text.toLowerCase()
  if (KEYWORDS_ROJO.some((k) => lower.includes(k))) return 'rojo'
  if (KEYWORDS_AMARILLO.some((k) => lower.includes(k))) return 'amarillo'
  return 'verde'
}

// ─── Análisis Claude completo ─────────────────────────────────────────────────

interface AnalysisResult {
  semaforo: 'verde' | 'amarillo' | 'rojo'
  riesgo: 'bajo' | 'medio' | 'alto'
  clasificacion: 'positivo' | 'negativo' | 'neutro' | 'pregunta' | 'interes' | 'precio' | 'no_clasificado'
  delegar: boolean
  razonDelegacion: string
  tieneIntencionReunion: boolean
  esRespuestaReal: boolean
  reply: string
}

async function analyzeEmail(
  emailBody: string,
  lead: any,
  priceThreshold: number,
  preClassification: 'rojo' | 'amarillo' | 'verde',
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Eres el sistema de inteligencia comercial de Nexus Digital. Analiza este email de un potencial cliente y determina la respuesta apropiada.

LEAD: ${lead.nombre} | Sector: ${lead.sector ?? 'N/A'} | Problema: ${lead.problemaDetectado ?? 'N/A'} | Valor estimado: ${lead.valorEstimado ? `${lead.valorEstimado}€` : 'N/A'}
PRE-CLASIFICACIÓN: ${preClassification}
UMBRAL APROBACIÓN ECONÓMICA: ${priceThreshold}€
EMAIL RECIBIDO:
---
${emailBody.substring(0, 1500)}
---

Analiza y devuelve SOLO JSON:
{
  "es_respuesta_real": true/false,
  "semaforo": "verde|amarillo|rojo",
  "riesgo": "bajo|medio|alto",
  "clasificacion": "positivo|negativo|neutro|pregunta|interes|precio|no_clasificado",
  "delegar": true/false,
  "razon_delegacion": "por qué delegar si aplica",
  "tiene_intencion_reunion": true/false,
  "reply": "respuesta automática si semaforo=verde y no delegar, si no: vacío"
}

REGLA CRÍTICA — es_respuesta_real:
- false si es: auto-respuesta, fuera de oficina, "responderemos en X horas", confirmación automática de recepción, mensaje de sistema, respuesta de vacaciones
- true si es una persona real que responde al email comercial (aunque sea breve o negativa)

REGLAS SEMÁFORO:
- ROJO: solicita descuento/precio final/contrato, respuesta claramente negativa, lenguaje conflictivo, importe implícito > ${priceThreshold}€
- AMARILLO: pregunta por precio sin negociar, pide plazo específico, requiere condiciones especiales, ambigüedad moderada
- VERDE: interés positivo, preguntas generales, acepta reunión, confirma interés

REGLAS DELEGACIÓN:
- Si semaforo=rojo → SIEMPRE delegar
- Si semaforo=amarillo → delegar si la pregunta requiere decision comercial
- Si verde → NO delegar, generar respuesta

REPLY (solo si verde y no delegar):
- Profesional, cercano, en español de España
- Agradece el interés
- Si menciona reunión o hora: di que perfecto y que te pondrás en contacto muy pronto (NO prometas enviar horarios ni calendarios, eso lo hace Ignacio manualmente)
- Si no menciona reunión: propón llamada de 15 min, pide que te digan cuándo les viene bien
- Máx 80 palabras. Firma: "Ignacio, Nexus Digital"
- Solo texto plano, sin markdown`,
    }],
  })

  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? text)
    return {
      esRespuestaReal: parsed.es_respuesta_real !== false,
      semaforo: parsed.semaforo ?? 'amarillo',
      riesgo: parsed.riesgo ?? 'medio',
      clasificacion: parsed.clasificacion ?? 'no_clasificado',
      delegar: parsed.delegar ?? true,
      razonDelegacion: parsed.razon_delegacion ?? '',
      tieneIntencionReunion: parsed.tiene_intencion_reunion ?? false,
      reply: parsed.reply ?? '',
    }
  } catch {
    return {
      esRespuestaReal: true,
      semaforo: 'amarillo',
      riesgo: 'medio',
      clasificacion: 'no_clasificado',
      delegar: true,
      razonDelegacion: 'Error al analizar — revisión manual requerida',
      tieneIntencionReunion: false,
      reply: '',
    }
  }
}

// ─── Crear tarea CEO ──────────────────────────────────────────────────────────

async function crearTareaCEO(
  leadId: string,
  leadNombre: string,
  motivo: string,
  emailBody: string,
  urgencia: 'alta' | 'media' = 'alta',
) {
  await prisma.tarea.create({
    data: {
      titulo: `🔴 CEO: ${leadNombre} — ${motivo}`,
      descripcion: `Acción requerida por el CEO humano.\n\nMotivo: ${motivo}\n\nEmail recibido:\n${emailBody.substring(0, 600)}`,
      prioridad: urgencia,
      estado: 'pendiente',
      tipo: 'aprobacion',
      leadId,
    },
  })
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const isCron = req.headers.get('x-cron') === process.env.CRON_SECRET
  if (!session && !isCron) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken ?? req.headers.get('x-google-token')
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible.' }, { status: 401 })

  const priceThreshold = await getPriceThreshold()

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const leadIds = await prisma.lead.findMany({
    where: { emailEnviado: true, email: { not: null } },
    select: { id: true, email: true, nombre: true, sector: true, ciudad: true, problemaDetectado: true, valorEstimado: true },
  })

  if (leadIds.length === 0) {
    return NextResponse.json({ ok: true, procesados: 0, respondidos: 0, delegados: 0, rebotes: 0, mensaje: 'No hay leads contactados aún.' })
  }

  const emailToLead = new Map(leadIds.map((l) => [l.email!.toLowerCase(), l]))

  const listRes = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox newer_than:3d', maxResults: 50 }).catch(() => ({ data: { messages: [] } }))
  const messages = listRes.data.messages ?? []

  let respondidos = 0
  let delegados = 0
  let rebotes = 0
  let rojos = 0
  const detalles: string[] = []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' }).catch(() => null)
    if (!full) continue

    const headers = full.data.payload?.headers ?? []
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? ''
    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? ''
    const threadId = full.data.threadId ?? ''

    // ── Extraer cuerpo una vez para todos los checks ──────────────────────────
    let rawBody = ''
    for (const part of full.data.payload?.parts ?? []) {
      if (part.mimeType === 'text/plain' && part.body?.data) { rawBody = Buffer.from(part.body.data, 'base64').toString('utf-8'); break }
    }
    if (!rawBody && full.data.payload?.body?.data) rawBody = Buffer.from(full.data.payload.body.data, 'base64').toString('utf-8')

    // ── Rebotes — mover a papelera en Gmail, no guardar en inbox ─────────────
    if (isBounce(fromHeader, subjectHeader, rawBody)) {
      const yaProcessed = await prisma.email.findFirst({ where: { gmailMessageId: msg.id! } })
      if (!yaProcessed) {
        const bouncedEmail = extractBouncedEmail(rawBody)
        const leadRebotado = bouncedEmail ? emailToLead.get(bouncedEmail) : null

        if (leadRebotado) {
          const ESTADOS_VALIOSOS = ['respondio', 'interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion', 'ganado']
          const leadData = await prisma.lead.findUnique({ where: { id: leadRebotado.id }, select: { estado: true } })
          if (leadData && !ESTADOS_VALIOSOS.includes(leadData.estado)) {
            await prisma.email.deleteMany({ where: { leadId: leadRebotado.id } })
            await prisma.actividad.deleteMany({ where: { leadId: leadRebotado.id } })
            await prisma.tarea.deleteMany({ where: { leadId: leadRebotado.id } })
            await prisma.lead.delete({ where: { id: leadRebotado.id } })
            detalles.push(`${leadRebotado.nombre}: rebote — lead eliminado (email ${bouncedEmail} inválido)`)
          } else if (leadData) {
            await prisma.lead.update({ where: { id: leadRebotado.id }, data: { email: null, emailEnviado: false, notas: `Email ${bouncedEmail} inválido (rebote)` } })
            await prisma.actividad.create({ data: { tipo: 'estado_cambiado', descripcion: `Rebote: ${bouncedEmail} inválido. Email eliminado, lead conservado.`, leadId: leadRebotado.id } })
            detalles.push(`${leadRebotado.nombre}: rebote — email borrado (lead en pipeline, conservado)`)
          }
          rebotes++
        }
        // Guardar solo como referencia interna (sin leadId = no aparece en inbox)
        await prisma.email.create({ data: { gmailMessageId: msg.id!, gmailThreadId: threadId, tipo: 'recibido', asunto: subjectHeader, cuerpo: rawBody.substring(0, 200), fecha: new Date() } }).catch(() => {})
      }
      // Mover a papelera en Gmail (no solo marcar leído)
      await gmail.users.messages.trash({ userId: 'me', id: msg.id! }).catch(() => {})
      continue
    }

    // ── Auto-respuestas — mover a papelera, ignorar silenciosamente ──────────
    if (isAutoReply(headers, subjectHeader, rawBody)) {
      const yaProcessed = await prisma.email.findFirst({ where: { gmailMessageId: msg.id! } })
      if (!yaProcessed) {
        await prisma.email.create({ data: { gmailMessageId: msg.id!, gmailThreadId: threadId, tipo: 'recibido', asunto: subjectHeader, cuerpo: 'Auto-respuesta ignorada', fecha: new Date() } }).catch(() => {})
      }
      await gmail.users.messages.trash({ userId: 'me', id: msg.id! }).catch(() => {})
      continue
    }

    // ── Identificar lead ──────────────────────────────────────────────────────
    const fromEmail = fromHeader.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0]?.toLowerCase()
    if (!fromEmail) continue
    const lead = emailToLead.get(fromEmail)
    if (!lead) continue

    const yaProcessed = await prisma.email.findFirst({ where: { gmailMessageId: msg.id! } })
    if (yaProcessed) continue

    const body = stripQuotedReply(rawBody)
    if (!body.trim()) continue

    // ── Guardar email recibido ────────────────────────────────────────────────
    await prisma.email.create({
      data: { leadId: lead.id, gmailMessageId: msg.id!, gmailThreadId: threadId, tipo: 'recibido', asunto: subjectHeader, cuerpo: body.substring(0, 2000), destinatario: fromEmail, fecha: new Date() },
    })
    await gmail.users.messages.modify({ userId: 'me', id: msg.id!, requestBody: { removeLabelIds: ['UNREAD'] } }).catch(() => {})

    // ── Pre-clasificación rápida (sin IA) ─────────────────────────────────────
    const preClass = preClassifySemaforo(body)

    // ── Análisis completo con Claude ──────────────────────────────────────────
    const analysis = await analyzeEmail(body, lead, priceThreshold, preClass)

    // ── Si no es respuesta real (auto-reply detectado por IA) ─────────────────
    if (!analysis.esRespuestaReal) {
      await prisma.actividad.create({ data: { tipo: 'email_recibido', descripcion: `Auto-respuesta ignorada de ${lead.nombre} — no es respuesta real`, leadId: lead.id } })
      continue
    }

    // ── Actualizar semáforo y riesgo en el lead ───────────────────────────────
    const prevLead = await prisma.lead.findUnique({ where: { id: lead.id }, select: { semaforo: true, riesgoComercial: true } })
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        estado: analysis.clasificacion === 'negativo' ? 'perdido' : 'respondio',
        semaforo: analysis.semaforo,
        riesgoComercial: analysis.riesgo,
        clasificacionRespuesta: analysis.clasificacion,
        respuestaRecibida: true,
        resumenRespuesta: body.substring(0, 300),
        ultimoContactoEn: new Date(),
      },
    })

    // Registrar cambio de semáforo si cambió
    if (prevLead?.semaforo !== analysis.semaforo) {
      await prisma.actividad.create({
        data: { tipo: 'semaforo_cambiado', descripcion: `Semáforo: ${prevLead?.semaforo ?? 'verde'} → ${analysis.semaforo} (${analysis.clasificacion})`, leadId: lead.id },
      })
    }

    // ── Respuesta negativa: cierre educado automático ────────────────────────
    if (analysis.clasificacion === 'negativo') {
      const replySubject = subjectHeader.toLowerCase().startsWith('re:') ? subjectHeader : `Re: ${subjectHeader}`
      const replyBody = `Hola,\n\nMuchas gracias por tomarte el tiempo de responder.\n\nEntendemos perfectamente tu decisión y lo respetamos. Si en algún momento cambia la situación o surge alguna necesidad relacionada con presencia digital o marketing online, no dudes en contactarnos. Estaremos encantados de ayudarte.\n\nUn cordial saludo,\nIgnacio\nNexus Digital`
      try {
        const lines = [
          `To: ${fromEmail}`,
          `Subject: =?UTF-8?B?${Buffer.from(replySubject).toString('base64')}?=`,
          `In-Reply-To: ${msg.id!}`,
          `References: ${msg.id!}`,
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          '',
          replyBody,
        ]
        const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
        const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw, ...(threadId ? { threadId } : {}) } })
        await prisma.email.create({
          data: {
            leadId: lead.id,
            gmailMessageId: sent.data.id ?? `sent_neg_${Date.now()}`,
            gmailThreadId: sent.data.threadId ?? threadId,
            tipo: 'enviado',
            asunto: replySubject,
            cuerpo: replyBody,
            destinatario: fromEmail,
            fecha: new Date(),
          },
        })
      } catch { /* no bloquear si falla el envío */ }
      await prisma.actividad.create({
        data: { tipo: 'email_enviado', descripcion: `Cierre educado enviado automáticamente a ${lead.nombre} (no interesado)`, leadId: lead.id },
      })
      respondidos++
      detalles.push(`${lead.nombre}: no interesado — cierre educado enviado`)
      continue
    }

    // ── Lógica por semáforo ───────────────────────────────────────────────────
    if (analysis.semaforo === 'rojo') {
      // ROJO: bloquear respuesta automática, crear tarea para CEO
      await crearTareaCEO(lead.id, lead.nombre, analysis.razonDelegacion || 'Lead en semáforo rojo', body)
      await prisma.actividad.create({
        data: { tipo: 'riesgo_detectado', descripcion: `🔴 Riesgo alto detectado: ${analysis.razonDelegacion}`, leadId: lead.id },
      })
      delegados++
      rojos++
      detalles.push(`${lead.nombre}: 🔴 ROJO — ${analysis.razonDelegacion}`)
      continue
    }

    if (analysis.semaforo === 'amarillo' && analysis.delegar) {
      // AMARILLO con delegación: revisar antes de responder
      await prisma.tarea.create({
        data: {
          titulo: `🟡 Revisar respuesta de ${lead.nombre} — ${analysis.clasificacion}`,
          descripcion: `Semáforo amarillo. Requiere revisión.\n\nMotivo: ${analysis.razonDelegacion}\n\nEmail:\n${body.substring(0, 500)}`,
          prioridad: 'alta',
          estado: 'pendiente',
          tipo: 'revision',
          leadId: lead.id,
        },
      })
      await prisma.actividad.create({
        data: { tipo: 'email_recibido', descripcion: `Respuesta de ${lead.nombre} (🟡 amarillo — revisión requerida)`, leadId: lead.id },
      })
      delegados++
      detalles.push(`${lead.nombre}: 🟡 amarillo — ${analysis.razonDelegacion}`)
      continue
    }

    // VERDE (o amarillo sin delegación): guardar borrador — NUNCA enviar automáticamente
    const draftReply = analysis.reply || ''
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        estado: analysis.tieneIntencionReunion ? 'negociacion' : 'interesado',
        borradorRespuesta: draftReply || null,
        borradorThreadId: threadId || null,
        borradorMsgId: msg.id || null,
        ultimoContactoEn: new Date(),
      },
    })

    // Si quiere reunión → crear evento en Google Calendar como recordatorio
    if (analysis.tieneIntencionReunion) {
      try {
        const cal = google.calendar({ version: 'v3', auth })
        // 2 días hábiles desde ahora a las 10:00
        const base = new Date()
        base.setDate(base.getDate() + 2)
        if (base.getDay() === 6) base.setDate(base.getDate() + 2) // sábado → lunes
        if (base.getDay() === 0) base.setDate(base.getDate() + 1) // domingo → lunes
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0)
        const end   = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 30, 0)
        const eventRes = await cal.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `🗓 Reunión pendiente — ${lead.nombre}`,
            description: `${lead.nombre} ha mostrado interés en reunirse. Pendiente de confirmar horario definitivo.\n\nEmail: ${fromEmail}${lead.sector ? `\nSector: ${lead.sector}` : ''}`,
            start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
            end:   { dateTime: end.toISOString(),   timeZone: 'Europe/Madrid' },
            colorId: '5',
          },
        })
        await prisma.reunion.create({
          data: {
            leadId: lead.id,
            googleEventId: eventRes.data.id ?? undefined,
            titulo: `Reunión pendiente — ${lead.nombre}`,
            descripcion: `Confirmada por email. Hora provisional — ajustar con el lead.`,
            fechaInicio: start,
            fechaFin: end,
            estado: 'pendiente',
          },
        })
      } catch { /* no bloquear si falla Calendar */ }
    }

    const tareaDesc = draftReply
      ? `📥 Email recibido:\n${body.substring(0, 400)}\n\n✏️ BORRADOR IA (edita y envía desde el perfil del lead):\n\n${draftReply}`
      : `📥 Email recibido:\n${body.substring(0, 400)}\n\nRedacta y envía la respuesta manualmente.`

    await prisma.tarea.create({
      data: {
        titulo: `✉️ Aprobar respuesta a ${lead.nombre}${analysis.tieneIntencionReunion ? ' — quiere reunión' : ''}`,
        descripcion: tareaDesc,
        prioridad: 'alta',
        estado: 'pendiente',
        tipo: 'aprobacion',
        leadId: lead.id,
      },
    })
    await prisma.actividad.create({
      data: { tipo: 'email_recibido', descripcion: `Respuesta de ${lead.nombre} (🟢 verde)${analysis.tieneIntencionReunion ? ' — intención de reunión' : ''} — borrador pendiente de aprobación`, leadId: lead.id },
    })

    delegados++
    detalles.push(`${lead.nombre}: 🟢 verde — borrador guardado, pendiente de aprobación`)
  }

  await prisma.agente.updateMany({ where: { tipo: 'seguimiento' }, data: { ultimaEjecucion: new Date() } })

  return NextResponse.json({ ok: true, procesados: messages.length, respondidos, delegados, rebotes, rojos, detalles })
}
