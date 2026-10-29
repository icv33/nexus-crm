import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible' }, { status: 401 })

  const { id } = await params
  const { texto } = await req.json()

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { nombre: true, email: true, borradorThreadId: true, borradorMsgId: true, borradorRespuesta: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'Lead sin email' }, { status: 400 })

  const cuerpo: string = texto ?? lead.borradorRespuesta ?? ''
  if (!cuerpo.trim()) return NextResponse.json({ error: 'Sin texto para enviar' }, { status: 400 })

  const threadId = lead.borradorThreadId ?? undefined
  const msgId = lead.borradorMsgId ?? undefined

  const subject = `Re: Nexus Digital`
  const lines = [
    `To: ${lead.email}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    ...(msgId ? [`In-Reply-To: ${msgId}`, `References: ${msgId}`] : []),
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    cuerpo,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw, ...(threadId ? { threadId } : {}) } })

  await Promise.all([
    prisma.email.create({
      data: {
        leadId: id,
        gmailMessageId: sent.data.id ?? `sent_${Date.now()}`,
        gmailThreadId: sent.data.threadId ?? threadId ?? undefined,
        tipo: 'enviado',
        asunto: subject,
        cuerpo,
        destinatario: lead.email,
        fecha: new Date(),
      },
    }),
    prisma.lead.update({
      where: { id },
      data: {
        borradorRespuesta: null,
        borradorThreadId: null,
        borradorMsgId: null,
        ultimoContactoEn: new Date(),
      },
    }),
    prisma.actividad.create({
      data: { tipo: 'email_enviado', descripcion: `Respuesta enviada manualmente a ${lead.nombre} (borrador aprobado)`, leadId: id },
    }),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  await prisma.lead.update({
    where: { id },
    data: { borradorRespuesta: null, borradorThreadId: null, borradorMsgId: null },
  })
  await prisma.actividad.create({
    data: { tipo: 'nota_agregada', descripcion: 'Borrador de respuesta descartado', leadId: id },
  })
  return NextResponse.json({ ok: true })
}
