import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const AGENTES_INICIALES = [
  {
    nombre: 'Agente de Prospección', tipo: 'prospeccion' as const,
    descripcion: 'Busca negocios locales como leads potenciales.',
    accionesPermitidas: ['buscar_negocios', 'crear_lead'],
    accionesRequierenAprobacion: ['enviar_email', 'contactar_lead'],
  },
  {
    nombre: 'Agente Analista', tipo: 'analista' as const,
    descripcion: 'Analiza leads y detecta oportunidades de negocio.',
    accionesPermitidas: ['analizar_lead', 'actualizar_puntuacion', 'recomendar_servicio'],
    accionesRequierenAprobacion: ['descartar_lead'],
  },
  {
    nombre: 'Agente Generador de Email', tipo: 'email_generator' as const,
    descripcion: 'Genera emails personalizados para cada lead.',
    accionesPermitidas: ['generar_borrador_email'],
    accionesRequierenAprobacion: ['enviar_email'],
  },
  {
    nombre: 'Agente de Seguimiento', tipo: 'seguimiento' as const,
    descripcion: 'Hace seguimiento de leads sin respuesta.',
    accionesPermitidas: ['generar_seguimiento', 'crear_tarea'],
    accionesRequierenAprobacion: ['enviar_seguimiento'],
  },
  {
    nombre: 'Agente Comercial', tipo: 'comercial' as const,
    descripcion: 'Gestiona conversaciones y negociaciones básicas.',
    accionesPermitidas: ['responder_preguntas', 'explicar_servicios', 'crear_tarea_escalado'],
    accionesRequierenAprobacion: ['enviar_respuesta', 'proponer_precio', 'agendar_llamada'],
  },
  {
    nombre: 'Agente de Calendario', tipo: 'calendario' as const,
    descripcion: 'Gestiona la agenda y crea reuniones.',
    accionesPermitidas: ['consultar_disponibilidad', 'proponer_horarios'],
    accionesRequierenAprobacion: ['crear_reunion', 'modificar_reunion', 'cancelar_reunion'],
  },
  {
    nombre: 'Agente de Propuestas', tipo: 'propuestas' as const,
    descripcion: 'Genera propuestas comerciales personalizadas.',
    accionesPermitidas: ['generar_borrador_propuesta'],
    accionesRequierenAprobacion: ['enviar_propuesta', 'modificar_precio'],
  },
  {
    nombre: 'Agente de Requisitos', tipo: 'requisitos' as const,
    descripcion: 'Recopila requisitos del proyecto con el cliente.',
    accionesPermitidas: ['crear_ficha_requisitos', 'enviar_formulario'],
    accionesRequierenAprobacion: ['confirmar_requisitos'],
  },
  {
    nombre: 'Agente Constructor', tipo: 'constructor' as const,
    descripcion: 'Asiste en la construcción de entregables.',
    accionesPermitidas: ['generar_codigo', 'crear_borrador'],
    accionesRequierenAprobacion: ['entregar_producto', 'publicar'],
  },
  {
    nombre: 'Agente QA', tipo: 'qa' as const,
    descripcion: 'Revisa la calidad de los entregables.',
    accionesPermitidas: ['revisar_entregable', 'generar_informe_qa'],
    accionesRequierenAprobacion: ['aprobar_entregable', 'rechazar_entregable'],
  },
  {
    nombre: 'Agente Resumen Diario', tipo: 'resumen_diario' as const,
    descripcion: 'Genera el resumen diario del negocio.',
    accionesPermitidas: ['generar_resumen', 'notificar_oportunidades'],
    accionesRequierenAprobacion: [],
  },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let agentes = await prisma.agente.findMany({ orderBy: { tipo: 'asc' }, include: { _count: { select: { logs: true } } } })

  // Seed agentes si no existen
  if (agentes.length === 0) {
    await prisma.agente.createMany({
      data: AGENTES_INICIALES.map((a) => ({
        ...a,
        accionesPermitidas: a.accionesPermitidas,
        accionesRequierenAprobacion: a.accionesRequierenAprobacion,
      })),
    })
    agentes = await prisma.agente.findMany({ orderBy: { tipo: 'asc' }, include: { _count: { select: { logs: true } } } })
  }

  return NextResponse.json({ agentes })
}
