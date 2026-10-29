import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { leadId, proyectoId } = await req.json().catch(() => ({}))
  if (!leadId && !proyectoId) return NextResponse.json({ error: 'leadId o proyectoId requerido' }, { status: 400 })

  let nombre = '', sector = '', servicio = '', notas = '', resolvedLeadId: string | null = null

  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    nombre = lead.nombre
    sector = lead.sector ?? ''
    servicio = lead.servicioRecomendado ?? ''
    notas = lead.notas ?? ''
    resolvedLeadId = lead.id
  } else if (proyectoId) {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: { lead: true },
    })
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    nombre = proyecto.lead?.nombre ?? proyecto.nombre
    sector = proyecto.lead?.sector ?? ''
    servicio = proyecto.etapa ?? ''
    notas = proyecto.datosPendientes ?? ''
    resolvedLeadId = proyecto.lead?.id ?? null
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Eres consultor técnico de Nexus Digital. Genera un documento de requisitos para este proyecto.

CLIENTE: ${nombre}
SECTOR: ${sector || 'No especificado'}
SERVICIO: ${servicio || 'Digitalización'}
CONTEXTO: ${notas || 'Sin notas adicionales'}

Genera las preguntas clave y requisitos necesarios para iniciar el proyecto.
Devuelve SOLO JSON con esta estructura exacta:
{
  "titulo": "Requisitos del proyecto para [nombre]",
  "preguntas": [
    {
      "categoria": "Negocio",
      "preguntas": ["¿Cuál es el objetivo principal...?", "¿Quién es tu cliente ideal...?"]
    },
    {
      "categoria": "Técnico",
      "preguntas": ["¿Tienes dominio y hosting?", "¿Usas algún sistema de gestión actual?"]
    },
    {
      "categoria": "Contenido",
      "preguntas": ["¿Tienes fotos del negocio?", "¿Quién redactará los textos?"]
    },
    {
      "categoria": "Diseño",
      "preguntas": ["¿Tienes logo o identidad visual?", "¿Referencias de webs que te gusten?"]
    }
  ],
  "entregables": ["Web responsive optimizada para SEO", "Panel de administración", "Formación básica"],
  "advertencias": ["Necesitaremos acceso a Google Business", "Tiempo estimado puede variar si hay cambios de scope"]
}
Adapta las preguntas al sector y servicio específico. Máx 3-4 preguntas por categoría.`,
    }],
  })

  let requisitosData: any
  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    requisitosData = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    return NextResponse.json({ error: 'Error al parsear respuesta de IA' }, { status: 500 })
  }

  if (resolvedLeadId) {
    await prisma.tarea.create({
      data: {
        titulo: `Recopilar requisitos: ${nombre}`,
        descripcion: `Cuestionario IA generado. Primera pregunta: "${requisitosData.preguntas?.[0]?.preguntas?.[0] ?? 'Ver documento'}"`,
        estado: 'pendiente',
        prioridad: 'alta',
        tipo: 'revision',
        leadId: resolvedLeadId,
      },
    })
    await prisma.actividad.create({
      data: {
        tipo: 'tarea_creada',
        descripcion: 'Documento de requisitos generado por Agente Requisitos',
        leadId: resolvedLeadId,
      },
    })
  }

  await prisma.agente.updateMany({
    where: { tipo: 'requisitos' },
    data: { ultimaEjecucion: new Date(), estado: 'activo' },
  })

  return NextResponse.json({ ok: true, requisitos: requisitosData })
}
