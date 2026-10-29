import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { extractEmailFromWeb } from '@/lib/email-extractor'

export const maxDuration = 120

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const leads = await prisma.lead.findMany({
    where: {
      web: { not: null },
      email: null,
      actividades: { none: { tipo: 'email_encontrado' } },
    },
    orderBy: [{ puntuacion: 'desc' }],
    take: 200,
  })

  if (leads.length === 0) {
    return NextResponse.json({ ok: true, encontrados: 0, procesados: 0, nombres: [], mensaje: 'No hay leads con web sin email.' })
  }

  let encontrados = 0
  const nombres: string[] = []

  // Procesar en grupos de 5 en paralelo
  const BATCH = 5
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map((l) => extractEmailFromWeb(l.web!)))
    for (let j = 0; j < batch.length; j++) {
      const r = results[j]
      const lead = batch[j]
      if (r.status === 'fulfilled' && r.value) {
        const email = r.value
        await prisma.lead.update({ where: { id: lead.id }, data: { email } })
        await prisma.actividad.create({ data: { tipo: 'email_encontrado', descripcion: `Email extraído de web: ${email}`, leadId: lead.id } })
        nombres.push(`${lead.nombre} → ${email}`)
        encontrados++
      } else {
        await prisma.actividad.create({ data: { tipo: 'email_encontrado', descripcion: 'Sin email en web', leadId: lead.id } })
      }
    }
  }

  return NextResponse.json({ ok: true, encontrados, procesados: leads.length, nombres })
}
