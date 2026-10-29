import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const reuniones = await prisma.reunion.findMany({
    orderBy: { fechaInicio: 'asc' },
    where: { fechaInicio: { gte: new Date() } },
    include: { lead: { select: { nombre: true } } },
    take: 20,
  })

  return NextResponse.json({ reuniones })
}
