import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Pixel transparente 1x1 PNG
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    await prisma.email
      .updateMany({ where: { trackingId: id, abierto: false }, data: { abierto: true, fechaApertura: new Date() } })
      .catch(() => {})
  }
  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}
