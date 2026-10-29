import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const RESULTADO_ESTADO: Record<string, string> = {
  interesado: 'interesado',
  no_interesa: 'descartado',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const { resultado, notas, duracion } = await req.json()

  const durStr = duracion ? ` (${duracion} min)` : ''
  const descripcion = `Llamada${durStr} — ${resultado.replace(/_/g, ' ')}${notas ? `: ${notas}` : ''}`

  await prisma.actividad.create({
    data: {
      tipo: 'llamada_realizada',
      descripcion,
      leadId: id,
      metadata: { resultado, duracion, notas } as any,
    },
  })

  // Actualizar estado si el resultado lo implica
  const nuevoEstado = RESULTADO_ESTADO[resultado]
  await prisma.lead.update({
    where: { id },
    data: {
      ultimoContactoEn: new Date(),
      ...(nuevoEstado ? { estado: nuevoEstado as any } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
