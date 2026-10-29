import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULTS: Record<string, string> = {
  TARGET_CITY: 'Zaragoza',
  AUTO_SEND_EMAILS: 'false',
  DAILY_EMAIL_LIMIT: '5',
  AUTO_NEGOTIATION: 'true',
  AUTO_CALENDAR_BOOKING: 'true',
  MAX_MEETINGS_PER_DAY: '3',
  DEFAULT_MEETING_DURATION: '30',
  MEETING_BUFFER_MINUTES: '15',
  PRICE_APPROVAL_THRESHOLD: '500',
  MEETING_START_MORNING: '10:00',
  MEETING_END_MORNING: '14:00',
  MEETING_START_AFTERNOON: '17:00',
  MEETING_END_AFTERNOON: '20:00',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rows = await prisma.configuracion.findMany()
  const config = { ...DEFAULTS }
  for (const row of rows) {
    config[row.clave] = row.valor
  }
  return NextResponse.json(config)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body: Record<string, string> = await req.json()

  await Promise.all(
    Object.entries(body).map(([clave, valor]) =>
      prisma.configuracion.upsert({
        where: { clave },
        update: { valor: String(valor) },
        create: { clave, valor: String(valor) },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
