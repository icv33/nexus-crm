import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM = `Eres el asistente IA de Nexus CRM, el CRM personal de Ignacio (fundador de Nexus Digital).
Tienes herramientas para gestionar el CRM: buscar/actualizar leads, gestionar tareas, ver estadísticas y guardar ideas de mejora.
Responde siempre en español, de forma concisa y directa. Cuando ejecutes una acción confírmala brevemente.
Si el usuario pide cambios en la app o nuevas funcionalidades, usa guardar_mejora para registrarlo — no puedes modificar el código directamente.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'buscar_leads',
    description: 'Busca leads en el CRM con filtros opcionales',
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Texto a buscar en nombre, email, ciudad o sector' },
        estado: { type: 'string', description: 'Estado: analizado, contactado, respondio, interesado, ganado, perdido, descartado...' },
        sector: { type: 'string' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
        sin_email: { type: 'boolean', description: 'Solo leads sin email' },
        semaforo: { type: 'string', enum: ['verde', 'amarillo', 'rojo'] },
        limite: { type: 'number', description: 'Máx resultados, default 10' },
      },
    },
  },
  {
    name: 'actualizar_lead',
    description: 'Actualiza campos de un lead. Busca por ID o nombre parcial.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        nombre: { type: 'string', description: 'Nombre del lead (búsqueda parcial si no tienes el ID)' },
        cambios: {
          type: 'object' as const,
          description: 'Campos: estado, prioridad, notas, proximaAccion, valorEstimado, email, telefono, semaforo',
        },
      },
      required: ['cambios'],
    },
  },
  {
    name: 'crear_tarea',
    description: 'Crea una tarea, opcionalmente vinculada a un lead',
    input_schema: {
      type: 'object' as const,
      properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
        lead_nombre: { type: 'string', description: 'Nombre del lead a asociar (opcional)' },
        vencimiento: { type: 'string', description: 'Fecha ISO 8601 (opcional)' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'listar_tareas',
    description: 'Lista tareas con filtros opcionales',
    input_schema: {
      type: 'object' as const,
      properties: {
        estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada', 'todas'] },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
        limite: { type: 'number' },
      },
    },
  },
  {
    name: 'gestionar_tarea',
    description: 'Completa o elimina una tarea por ID o título',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        titulo: { type: 'string', description: 'Título parcial para buscar si no tienes ID' },
        accion: { type: 'string', enum: ['completar', 'eliminar'] },
      },
      required: ['accion'],
    },
  },
  {
    name: 'obtener_estadisticas',
    description: 'Devuelve estadísticas actuales del CRM',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'guardar_mejora',
    description: 'Guarda una idea de mejora o nueva funcionalidad para la app Nexus. Úsalo cuando el usuario pida cambios en la aplicación.',
    input_schema: {
      type: 'object' as const,
      properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string', description: 'Qué se quiere y por qué, con suficiente detalle para implementarlo' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
      },
      required: ['titulo', 'descripcion'],
    },
  },
]

async function runTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'buscar_leads': {
        const where: any = {}
        if (input.q) {
          where.OR = [
            { nombre: { contains: input.q, mode: 'insensitive' } },
            { email: { contains: input.q, mode: 'insensitive' } },
            { ciudad: { contains: input.q, mode: 'insensitive' } },
            { sector: { contains: input.q, mode: 'insensitive' } },
          ]
        }
        if (input.estado) where.estado = input.estado
        if (input.sector && !input.q) where.sector = { contains: input.sector, mode: 'insensitive' }
        if (input.prioridad) where.prioridad = input.prioridad
        if (input.sin_email) where.email = null
        if (input.semaforo) where.semaforo = input.semaforo
        const leads = await prisma.lead.findMany({
          where,
          take: input.limite ?? 10,
          orderBy: { puntuacion: 'desc' },
          select: { id: true, nombre: true, sector: true, ciudad: true, email: true, telefono: true, estado: true, prioridad: true, puntuacion: true, semaforo: true },
        })
        if (!leads.length) return 'No se encontraron leads con esos filtros.'
        return JSON.stringify(leads)
      }

      case 'actualizar_lead': {
        let id = input.id
        if (!id && input.nombre) {
          const found = await prisma.lead.findFirst({ where: { nombre: { contains: input.nombre, mode: 'insensitive' } } })
          if (!found) return `No encontré lead con nombre "${input.nombre}".`
          id = found.id
        }
        if (!id) return 'Necesito el ID o nombre del lead.'
        const CAMPOS = ['estado', 'prioridad', 'notas', 'proximaAccion', 'valorEstimado', 'email', 'telefono', 'semaforo']
        const data: any = {}
        for (const k of CAMPOS) if (k in (input.cambios ?? {})) data[k] = input.cambios[k]
        if (!Object.keys(data).length) return 'No hay cambios válidos.'
        const lead = await prisma.lead.update({ where: { id }, data, select: { nombre: true } })
        return `"${lead.nombre}" actualizado: ${Object.entries(data).map(([k, v]) => `${k} → ${v}`).join(', ')}`
      }

      case 'crear_tarea': {
        let leadId: string | undefined
        if (input.lead_nombre) {
          const lead = await prisma.lead.findFirst({ where: { nombre: { contains: input.lead_nombre, mode: 'insensitive' } } })
          if (lead) leadId = lead.id
        }
        await prisma.tarea.create({
          data: {
            titulo: input.titulo,
            descripcion: input.descripcion,
            prioridad: input.prioridad ?? 'media',
            leadId,
            vencimiento: input.vencimiento ? new Date(input.vencimiento) : undefined,
            estado: 'pendiente',
            tipo: 'accion',
          },
        })
        return `Tarea "${input.titulo}" creada${leadId ? ` (vinculada a ${input.lead_nombre})` : ''}.`
      }

      case 'listar_tareas': {
        const where: any = {}
        if (input.estado && input.estado !== 'todas') where.estado = input.estado
        else if (!input.estado) where.estado = 'pendiente'
        if (input.prioridad) where.prioridad = input.prioridad
        const tareas = await prisma.tarea.findMany({
          where,
          take: input.limite ?? 10,
          orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
          include: { lead: { select: { nombre: true } } },
        })
        if (!tareas.length) return 'No hay tareas con esos filtros.'
        return JSON.stringify(tareas.map((t) => ({ id: t.id, titulo: t.titulo, prioridad: t.prioridad, estado: t.estado, lead: t.lead?.nombre ?? null, vencimiento: t.vencimiento })))
      }

      case 'gestionar_tarea': {
        let id = input.id
        if (!id && input.titulo) {
          const found = await prisma.tarea.findFirst({ where: { titulo: { contains: input.titulo, mode: 'insensitive' }, estado: { not: 'completada' } } })
          if (!found) return `No encontré tarea "${input.titulo}".`
          id = found.id
        }
        if (!id) return 'Necesito el ID o título de la tarea.'
        if (input.accion === 'eliminar') {
          await prisma.tarea.delete({ where: { id } })
          return 'Tarea eliminada.'
        }
        await prisma.tarea.update({ where: { id }, data: { estado: 'completada' } })
        return 'Tarea marcada como completada.'
      }

      case 'obtener_estadisticas': {
        const [totalLeads, porEstado, enviados, recibidos, abiertos, interesados, tareasPendientes, mejoras] = await Promise.all([
          prisma.lead.count(),
          prisma.lead.groupBy({ by: ['estado'], _count: true }),
          prisma.email.count({ where: { tipo: 'enviado' } }),
          prisma.email.count({ where: { tipo: 'recibido' } }),
          prisma.email.count({ where: { tipo: 'enviado', abierto: true } }),
          prisma.lead.count({ where: { estado: { in: ['interesado', 'reunion_agendada', 'propuesta_enviada', 'negociacion', 'ganado'] } } }),
          prisma.tarea.count({ where: { estado: 'pendiente' } }),
          prisma.mejora.count({ where: { estado: 'pendiente' } }),
        ])
        return JSON.stringify({
          total_leads: totalLeads,
          leads_interesados: interesados,
          emails_enviados: enviados,
          emails_recibidos: recibidos,
          emails_abiertos: abiertos,
          tasa_apertura: enviados > 0 ? `${((abiertos / enviados) * 100).toFixed(1)}%` : '0%',
          tasa_respuesta: enviados > 0 ? `${((recibidos / enviados) * 100).toFixed(1)}%` : '0%',
          tareas_pendientes: tareasPendientes,
          mejoras_pendientes: mejoras,
          por_estado: Object.fromEntries(porEstado.map((e) => [e.estado, e._count])),
        })
      }

      case 'guardar_mejora': {
        await prisma.mejora.create({
          data: {
            titulo: input.titulo,
            descripcion: input.descripcion,
            prioridad: input.prioridad ?? 'media',
          },
        })
        return `Mejora "${input.titulo}" guardada. La verás en la sección Mejoras para implementarla con Claude Code.`
      }

      default:
        return `Herramienta desconocida: ${name}`
    }
  } catch (e: any) {
    return `Error en ${name}: ${e.message}`
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { messages } = await req.json()
  if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages requerido' }, { status: 400 })

  const history: Anthropic.MessageParam[] = messages.map((m: any) => ({ role: m.role, content: m.content }))

  for (let round = 0; round < 5; round++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages: history,
    })

    const hasToolUse = response.content.some((b) => b.type === 'tool_use')

    if (!hasToolUse || response.stop_reason === 'end_turn') {
      const text = response.content.find((b) => b.type === 'text')
      return NextResponse.json({ message: text ? (text as Anthropic.TextBlock).text : 'Hecho.' })
    }

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await runTool(block.name, block.input as Record<string, any>)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
    }

    history.push({ role: 'assistant', content: response.content })
    history.push({ role: 'user', content: results })
  }

  return NextResponse.json({ message: 'Acciones ejecutadas.' })
}
