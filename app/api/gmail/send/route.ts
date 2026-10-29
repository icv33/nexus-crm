import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT ?? '5')
const AUTO_SEND = process.env.AUTO_SEND_EMAILS === 'true'

async function getTodayEmailCount(): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return prisma.email.count({
    where: { tipo: 'enviado', fecha: { gte: start } },
  })
}

function buildRaw(to: string, subject: string, body: string, replyToMsgId?: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ]
  if (replyToMsgId) lines.push(`In-Reply-To: ${replyToMsgId}`, `References: ${replyToMsgId}`)
  lines.push('', body)
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken

  if (!accessToken) return NextResponse.json({ error: 'No autenticado con Google' }, { status: 401 })

  const { to, subject, body, leadId, replyToMsgId, threadId, force } = await req.json()

  if (!to || !subject || !body) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  // Verificar límite diario
  const todayCount = await getTodayEmailCount()
  if (todayCount >= DAILY_LIMIT && !force) {
    return NextResponse.json({
      error: `Límite diario de ${DAILY_LIMIT} emails alcanzado. Usa force:true para forzar.`,
      limit: DAILY_LIMIT,
      sent: todayCount,
    }, { status: 429 })
  }

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    const raw = buildRaw(to, subject, body, replyToMsgId)
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, ...(threadId ? { threadId } : {}) },
    })

    // Registrar en base de datos
    await prisma.email.create({
      data: {
        leadId: leadId ?? null,
        gmailMessageId: res.data.id,
        gmailThreadId: res.data.threadId,
        tipo: 'enviado',
        asunto: subject,
        cuerpo: body,
        destinatario: to,
        fecha: new Date(),
      },
    })

    // Actualizar lead
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { emailEnviado: true, fechaEnvio: new Date(), ultimoContactoEn: new Date() },
      })
      await prisma.actividad.create({
        data: {
          tipo: 'email_enviado',
          descripcion: `Email enviado a ${to}: "${subject}"`,
          leadId,
          metadata: { asunto: subject, gmailMessageId: res.data.id },
        },
      })
    }

    return NextResponse.json({ success: true, messageId: res.data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al enviar' }, { status: 500 })
  }
}
