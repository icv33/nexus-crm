import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken

  if (!accessToken) return NextResponse.json({ error: 'No autenticado con Google' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const maxResults = parseInt(searchParams.get('max') ?? '20')

  try {
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults, q: 'is:unread' })
    const messages = listRes.data.messages ?? []

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me', id: msg.id!, format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
        const headers = detail.data.payload?.headers ?? []
        const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

        const from = getHeader('From')
        const match = from.match(/^(.*?)\s*<(.+)>$/)
        const remitente = match ? match[1].replace(/"/g, '').trim() : from
        const emailFrom = match ? match[2] : from

        return {
          gmailMessageId: msg.id,
          gmailThreadId: detail.data.threadId,
          asunto: getHeader('Subject') || '(Sin asunto)',
          remitente,
          emailFrom,
          preview: detail.data.snippet ?? '',
          fecha: getHeader('Date') ? new Date(getHeader('Date')).toISOString() : new Date().toISOString(),
        }
      })
    )

    return NextResponse.json({ emails })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al leer Gmail' }, { status: 500 })
  }
}
