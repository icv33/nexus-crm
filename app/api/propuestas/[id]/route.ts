import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFreshGoogleAccessToken } from '@/lib/google-token'
import { google } from 'googleapis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const propuesta = await prisma.propuesta.findUnique({
    where: { id },
    include: { lead: { select: { nombre: true, email: true, sector: true, ciudad: true } } },
  })
  if (!propuesta) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(propuesta)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const CAMPOS = ['servicioOfrecido', 'problemaDetectado', 'solucionPropuesta', 'precioEstimado', 'plazoEstimado', 'estado', 'notas']
  const data: Record<string, unknown> = {}
  for (const k of CAMPOS) if (k in body) data[k] = body[k]
  const propuesta = await prisma.propuesta.update({ where: { id }, data })
  return NextResponse.json(propuesta)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  await prisma.propuesta.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/propuestas/[id]/enviar — send proposal via email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  const propuesta = await prisma.propuesta.findUnique({
    where: { id },
    include: { lead: { select: { id: true, nombre: true, email: true, sector: true } } },
  })
  if (!propuesta) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (!propuesta.lead?.email) return NextResponse.json({ error: 'El lead no tiene email' }, { status: 400 })

  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken ?? await getFreshGoogleAccessToken()
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible' }, { status: 401 })

  const { lead } = propuesta
  const precio = propuesta.precioEstimado ? `€${propuesta.precioEstimado.toLocaleString('es-ES')}` : 'A convenir'
  const servicio = propuesta.servicioOfrecido.replace(/_/g, ' ')

  const cuerpo = `Hola,

Gracias por tu interés. Tal y como hablamos, te adjunto nuestra propuesta para ${lead.nombre}.

━━━━━━━━━━━━━━━━━━━━━━━━
PROPUESTA COMERCIAL — NEXUS DIGITAL
━━━━━━━━━━━━━━━━━━━━━━━━

Cliente: ${lead.nombre}
Servicio: ${servicio}
${propuesta.plazoEstimado ? `Plazo estimado: ${propuesta.plazoEstimado}` : ''}
Inversión: ${precio}

${propuesta.solucionPropuesta ? `SOLUCIÓN PROPUESTA:\n${propuesta.solucionPropuesta}\n` : ''}${propuesta.problemaDetectado ? `PROBLEMA QUE RESOLVEMOS:\n${propuesta.problemaDetectado}\n` : ''}${propuesta.notas ? `NOTAS ADICIONALES:\n${propuesta.notas}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━

Para cualquier duda o para avanzar con el proyecto, puedes responder directamente a este email.

Un saludo,
Ignacio
Nexus Digital`

  const subject = `Propuesta comercial para ${lead.nombre} — Nexus Digital`
  const lines = [
    `To: ${lead.email}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    cuerpo,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

  await Promise.all([
    prisma.propuesta.update({ where: { id }, data: { estado: 'enviada', fechaEnvio: new Date() } }),
    prisma.email.create({
      data: {
        leadId: lead.id,
        gmailMessageId: sent.data.id ?? undefined,
        gmailThreadId: sent.data.threadId ?? undefined,
        tipo: 'enviado',
        asunto: subject,
        cuerpo,
        destinatario: lead.email,
        fecha: new Date(),
      },
    }),
    prisma.actividad.create({
      data: { tipo: 'propuesta_creada', descripcion: `Propuesta enviada a ${lead.email} · ${precio}`, leadId: lead.id },
    }),
    prisma.lead.update({ where: { id: lead.id }, data: { estado: 'propuesta_enviada', ultimoContactoEn: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
