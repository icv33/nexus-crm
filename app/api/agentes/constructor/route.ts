import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { proyectoId } = await req.json().catch(() => ({}))
  if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 })

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      lead: { select: { nombre: true, sector: true, ciudad: true, problemaDetectado: true, notas: true } },
      propuesta: { select: { servicioOfrecido: true, solucionPropuesta: true, plazoEstimado: true, precioEstimado: true } },
    },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1600,
    messages: [{
      role: 'user',
      content: `Eres project manager experto de Nexus Digital. Genera un plan de proyecto detallado y accionable.

PROYECTO: ${proyecto.nombre}
SERVICIO VENDIDO: ${proyecto.servicioVendido}
ETAPA ACTUAL: ${proyecto.etapa}
VALOR: ${proyecto.valorTotal ? `${proyecto.valorTotal}€` : 'No definido'}
CLIENTE: ${proyecto.lead?.nombre ?? 'N/A'} | Sector: ${proyecto.lead?.sector ?? 'N/A'} | Ciudad: ${proyecto.lead?.ciudad ?? 'N/A'}
PROBLEMA DEL CLIENTE: ${proyecto.lead?.problemaDetectado ?? 'N/A'}
PROPUESTA: ${proyecto.propuesta?.solucionPropuesta ?? 'No especificada'}
PLAZO ACORDADO: ${proyecto.propuesta?.plazoEstimado ?? 'No especificado'}
DATOS ADICIONALES: ${proyecto.datosPendientes ?? proyecto.lead?.notas ?? 'Sin datos adicionales'}

Genera un plan completo y práctico.

Devuelve SOLO JSON:
{
  "fases": [
    {
      "nombre": "nombre de la fase (ej: Onboarding y requisitos)",
      "descripcion": "objetivo de la fase en 1 frase",
      "duracion": "ej: 2-3 días",
      "tareas": [
        "descripción concreta de tarea 1",
        "descripción concreta de tarea 2"
      ]
    }
  ],
  "entregables": [
    "entregable concreto 1",
    "entregable concreto 2"
  ],
  "herramientas": ["herramienta o tecnología recomendada"],
  "riesgos": [
    {
      "riesgo": "descripción del riesgo",
      "mitigacion": "cómo evitarlo o gestionarlo"
    }
  ],
  "duracion_total": "estimación total (ej: 3-4 semanas)",
  "proxima_accion": "primera acción concreta que hacer mañana para iniciar el proyecto"
}

Adapta EXACTAMENTE al tipo de servicio y sector. Máx 4 fases, 3-4 tareas por fase.`,
    }],
  })

  let plan: any
  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    plan = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    return NextResponse.json({ error: 'Error al generar plan del proyecto' }, { status: 500 })
  }

  // Persist to proyecto
  await prisma.proyecto.update({
    where: { id: proyectoId },
    data: {
      fichaRequisitos: plan,
      entregables: Array.isArray(plan.entregables) ? plan.entregables : [],
    },
  })

  // Create immediate next-step task
  if (plan.proxima_accion && proyecto.leadId) {
    await prisma.tarea.create({
      data: {
        titulo: `[${proyecto.nombre}] ${plan.proxima_accion}`,
        descripcion: `Generado automáticamente por Agente Constructor. Plan completo en el proyecto.`,
        estado: 'pendiente',
        prioridad: 'alta',
        tipo: 'accion',
        leadId: proyecto.leadId,
      },
    })
  }

  await prisma.agente.updateMany({
    where: { tipo: 'constructor' },
    data: { ultimaEjecucion: new Date(), estado: 'activo' },
  })

  return NextResponse.json({ ok: true, plan, proyectoId })
}
