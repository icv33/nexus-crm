import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [empresas, total] = await Promise.all([
    prisma.empresa.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.empresa.count(),
  ])
  return NextResponse.json({ empresas, total })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const empresa = await prisma.empresa.create({ data: body })
  return NextResponse.json(empresa, { status: 201 })
}
