import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await prisma.actividad.deleteMany({})
  await prisma.email.deleteMany({})
  await prisma.tarea.deleteMany({})
  await prisma.reunion.deleteMany({})
  await prisma.propuesta.deleteMany({})
  await prisma.lead.deleteMany({})

  return NextResponse.json({ ok: true })
}
