import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const SERVICIOS = ['web', 'mejora_web', 'whatsapp', 'automatizacion_correos', 'automatizacion_formularios', 'sistema_reservas', 'automatizacion_interna']

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || key === 'TU_API_KEY_AQUI') throw new Error('ANTHROPIC_API_KEY no configurada')
  return new Anthropic({ apiKey: key })
}

async function runAnalista(lead: any) {
  const client = getClient()

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Eres un analista de negocio experto en digitalización de PYMEs españolas. Analiza este negocio local y devuelve un JSON con el análisis.

NEGOCIO:
- Nombre: ${lead.nombre}
- Sector: ${lead.sector ?? 'desconocido'}
- Ciudad: ${lead.ciudad ?? 'España'}
- Web: ${lead.web ?? 'sin web'}
- Notas previas: ${lead.notas ?? 'ninguna'}

Devuelve SOLO este JSON (sin markdown):
{
  "problemaDetectado": "descripción del problema principal de digitalización (2-3 frases)",
  "servicioRecomendado": "uno de: ${SERVICIOS.join(', ')}",
  "puntuacion": número del 1 al 10 según potencial de conversión,
  "razonPuntuacion": "por qué esta puntuación (1 frase)"
}`,
    }],
  })

  const text = (msg.content[0] as any).text.trim()
  const json = JSON.parse(text)
  return json
}

async function runEmailGenerator(lead: any) {
  const client = getClient()

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Eres un experto en ventas B2B para una empresa de automatización e IA. Escribe un email de prospección en español para este negocio local.

NEGOCIO:
- Nombre: ${lead.nombre}
- Sector: ${lead.sector ?? 'desconocido'}
- Ciudad: ${lead.ciudad ?? 'España'}
- Problema detectado: ${lead.problemaDetectado ?? 'presencia digital mejorable'}
- Servicio a ofrecer: ${lead.servicioRecomendado?.replace(/_/g, ' ') ?? 'automatización'}

REGLAS:
- Tono profesional pero cercano, en español de España
- NO menciones precios ni plazos
- Referencia específicamente su negocio y sector
- Máximo 200 palabras
- Termina con una CTA para una llamada de 15 minutos
- Firma: "Ignacio, fundador de [tu empresa]"
- Devuelve SOLO el texto del email, sin asunto, sin markdown`,
    }],
  })

  return (msg.content[0] as any).text.trim()
}

async function runSeguimiento(lead: any) {
  const client = getClient()

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Escribe un email de seguimiento en español para un lead que no ha respondido al primer contacto.

NEGOCIO: ${lead.nombre} (${lead.sector ?? 'sector desconocido'})
EMAIL ORIGINAL (resumen): sobre mejorar su presencia digital con ${lead.servicioRecomendado?.replace(/_/g, ' ') ?? 'automatización'}

REGLAS:
- Breve (máximo 100 palabras)
- No insistente, añade valor nuevo
- Menciona un beneficio concreto del sector
- Termina con pregunta directa
- Devuelve SOLO el texto del email`,
    }],
  })

  return (msg.content[0] as any).text.trim()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo, leadId } = await req.json()
  if (!tipo || !leadId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const agente = await prisma.agente.findFirst({ where: { tipo: tipo as any } })

  try {
    let resultado: Record<string, unknown> = {}
    let descripcionActividad = ''

    if (tipo === 'analista') {
      const analisis = await runAnalista(lead)
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          problemaDetectado: analisis.problemaDetectado,
          servicioRecomendado: analisis.servicioRecomendado,
          puntuacion: Math.min(10, Math.max(1, parseInt(analisis.puntuacion))),
          estado: lead.estado === 'nuevo' ? 'analizado' : lead.estado,
        },
      })
      resultado = analisis
      descripcionActividad = `Agente Analista: ${analisis.razonPuntuacion ?? 'análisis completado'}`
    }

    if (tipo === 'email_generator') {
      const emailTexto = await runEmailGenerator(lead)
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          emailPreparado: emailTexto,
          estado: lead.estado === 'analizado' ? 'preparado_para_contactar' : lead.estado,
        },
      })
      resultado = { emailPreparado: emailTexto }
      descripcionActividad = 'Agente Email Generator: email de prospección generado'
    }

    if (tipo === 'seguimiento') {
      const emailTexto = await runSeguimiento(lead)
      // Guardar como notas del lead para que el usuario pueda copiarlo
      await prisma.lead.update({
        where: { id: leadId },
        data: { proximaAccion: `Enviar seguimiento: ${emailTexto.substring(0, 80)}...` },
      })
      resultado = { emailSeguimiento: emailTexto }
      descripcionActividad = 'Agente Seguimiento: email de seguimiento generado'
    }

    if (!descripcionActividad) {
      return NextResponse.json({ error: `Tipo de agente no soportado: ${tipo}` }, { status: 400 })
    }

    // Registrar log del agente
    if (agente) {
      await prisma.agenteLog.create({
        data: {
          agenteId: agente.id,
          mensaje: descripcionActividad,
          metadata: { tipo, leadId, leadNombre: lead.nombre, resultado } as any,
        },
      })
      await prisma.agente.update({
        where: { id: agente.id },
        data: { ultimaEjecucion: new Date() },
      })
    }

    await prisma.actividad.create({
      data: {
        tipo: 'agente_ejecutado',
        descripcion: descripcionActividad,
        leadId,
        agenteId: agente?.id,
      },
    })

    return NextResponse.json({ ok: true, resultado })
  } catch (err: any) {
    if (agente) {
      await prisma.agenteLog.create({
        data: {
          agenteId: agente.id,
          nivel: 'error',
          mensaje: `Error en agente ${tipo}: ${err.message}`,
          metadata: { tipo, leadId } as any,
        },
      })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
