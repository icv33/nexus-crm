import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

async function generarEmail(lead: any): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Eres un experto en ventas B2B para una empresa de automatización e IA. Escribe un email de prospección en español para este negocio local.

NEGOCIO:
- Nombre: ${lead.nombre}
- Sector: ${lead.sector ?? 'desconocido'}
- Ciudad: ${lead.ciudad ?? 'Zaragoza'}
- Problema detectado: ${lead.problemaDetectado ?? 'presencia digital mejorable'}
- Servicio a ofrecer: ${lead.servicioRecomendado?.replace(/_/g, ' ') ?? 'digitalización'}

REGLAS:
- Tono profesional pero cercano, español de España
- NO menciones precios ni plazos
- Referencia específicamente su negocio y sector
- Máximo 180 palabras
- Termina con CTA para una llamada de 15 minutos
- Firma: "Ignacio, fundador de Nexus Digital"
- Devuelve SOLO el texto del email, sin asunto, sin markdown`,
    }],
  })
  return (msg.content[0] as any).text.trim()
}

function buildRaw(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ]
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

async function enviarEmail(accessToken: string, to: string, subject: string, body: string, leadId: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  const raw = buildRaw(to, subject, body)
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

  await prisma.email.create({
    data: {
      leadId,
      gmailMessageId: res.data.id,
      gmailThreadId: res.data.threadId,
      tipo: 'enviado',
      asunto: subject,
      cuerpo: body,
      destinatario: to,
      fecha: new Date(),
    },
  })

  await prisma.lead.update({
    where: { id: leadId },
    data: { estado: 'contactado', emailEnviado: true, fechaEnvio: new Date(), ultimoContactoEn: new Date() },
  })

  await prisma.actividad.create({
    data: {
      tipo: 'email_enviado',
      descripcion: `Email de prospección enviado a ${to}`,
      leadId,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible. Cierra sesión y vuelve a entrar.' }, { status: 401 })

  // Leads analizados con email sin contactar, ordenados por puntuación desc
  const leads = await prisma.lead.findMany({
    where: {
      email: { not: null },
      emailEnviado: false,
    },
    orderBy: [{ puntuacion: 'desc' }, { prioridad: 'asc' }],
  })

  if (leads.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, emailsGeneradosSinEnviar: 0, nombres: [], errores: [], mensaje: 'No hay leads con email pendientes de contactar.' })
  }

  const enviados: string[] = []
  const errores: string[] = []
  const sinEmail: string[] = []

  // Leads sin email para generarles el email pero no enviarlo
  const leadsSinEmail = await prisma.lead.findMany({
    where: { estado: 'analizado', email: null, emailPreparado: null },
    take: 20,
  })

  for (const lead of leadsSinEmail) {
    try {
      const texto = await generarEmail(lead)
      await prisma.lead.update({ where: { id: lead.id }, data: { emailPreparado: texto } })
      sinEmail.push(lead.nombre)
    } catch {}
  }

  for (const lead of leads) {
    if (!lead.email) continue

    try {
      let emailTexto = lead.emailPreparado
      if (!emailTexto) {
        emailTexto = await generarEmail(lead)
        await prisma.lead.update({ where: { id: lead.id }, data: { emailPreparado: emailTexto } })
      }

      const subject = `Hola ${lead.nombre} — una idea para mejorar vuestra presencia digital`
      await enviarEmail(accessToken, lead.email!, subject, emailTexto, lead.id)

      enviados.push(lead.nombre)

      await new Promise((r) => setTimeout(r, 1500))
    } catch (err: any) {
      errores.push(`${lead.nombre}: ${err.message}`)
    }
  }

  return NextResponse.json({
    ok: true,
    enviados: enviados.length,
    nombres: enviados,
    emailsGeneradosSinEnviar: sinEmail.length,
    errores,
  })
}
