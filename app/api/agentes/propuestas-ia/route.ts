import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { leadId } = await req.json().catch(() => ({}))
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Eres consultor de ventas de Nexus Digital, empresa de automatización e IA para negocios locales en España.

CLIENTE:
- Empresa: ${lead.nombre}
- Sector: ${lead.sector ?? 'N/A'}
- Ciudad: ${lead.ciudad ?? 'N/A'}
- Problema: ${lead.problemaDetectado ?? 'Presencia digital mejorable'}
- Servicio sugerido: ${lead.servicioRecomendado ?? 'Digitalización'}
- Puntuación: ${lead.puntuacion ?? 5}/10
- Notas: ${lead.notas ?? '—'}

CATÁLOGO NEXUS DIGITAL:
- Web profesional: desde 800€, plazo 3-4 semanas
- Sistema de reservas/citas online: desde 600€, plazo 2-3 semanas
- Automatización emails + CRM básico: desde 400€/mes
- Gestión Google Business y reseñas: desde 200€/mes
- Pack digitalización completo: desde 1.200€, plazo 4-6 semanas
- Chatbot IA para atención al cliente: desde 500€/mes

Genera una propuesta comercial adaptada. Devuelve SOLO JSON:
{
  "servicioOfrecido": "nombre del servicio principal a ofrecer",
  "problemaDetectado": "problema específico del cliente en 1-2 frases",
  "solucionPropuesta": "descripción de la solución con beneficios concretos en 3-4 frases",
  "precioEstimado": número en euros sin símbolo,
  "plazoEstimado": "ej: 3-4 semanas",
  "notas": "por qué esta solución es la mejor para este cliente específico + próximo paso recomendado"
}`,
    }],
  })

  let propuestaData: any
  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    propuestaData = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    return NextResponse.json({ error: 'Error al parsear respuesta de IA' }, { status: 500 })
  }

  const propuesta = await prisma.propuesta.create({
    data: {
      leadId,
      servicioOfrecido: propuestaData.servicioOfrecido ?? lead.servicioRecomendado ?? 'Digitalización',
      problemaDetectado: propuestaData.problemaDetectado ?? lead.problemaDetectado,
      solucionPropuesta: propuestaData.solucionPropuesta,
      precioEstimado: typeof propuestaData.precioEstimado === 'number' ? propuestaData.precioEstimado : null,
      plazoEstimado: propuestaData.plazoEstimado,
      notas: propuestaData.notas,
      estado: 'borrador',
    },
  })

  await prisma.actividad.create({
    data: {
      tipo: 'propuesta_creada',
      descripcion: `Propuesta IA generada: ${propuesta.servicioOfrecido}${propuesta.precioEstimado ? ` · ${propuesta.precioEstimado}€` : ''}`,
      leadId,
    },
  })

  await prisma.agente.updateMany({
    where: { tipo: 'propuestas' },
    data: { ultimaEjecucion: new Date(), estado: 'activo' },
  })

  return NextResponse.json({ ok: true, propuesta })
}
