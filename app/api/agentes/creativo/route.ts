import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { sector } = await req.json().catch(() => ({}))
  if (!sector?.trim()) return NextResponse.json({ error: 'sector requerido' }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1800,
    messages: [{
      role: 'user',
      content: `Eres estratega creativo de servicios digitales para negocios locales en España. Tu objetivo es generar ideas ESPECÍFICAS y CREATIVAS para el sector indicado — nada genérico.

SECTOR OBJETIVO: "${sector}"

Nexus Digital ofrece: webs, automatización, IA, sistemas de reservas, CRM, chatbots, gestión de reseñas, email marketing, apps.

Genera 6 ideas de servicios digitales que Nexus Digital podría vender a negocios de este sector.
Las ideas deben ser:
1. Específicas para los problemas/dolores REALES de ese sector
2. Implementables en 1-6 semanas
3. Con potencial de venta en el mercado español actual
4. Variadas: mezcla automatización, IA, web, marketing
5. Ordenadas de mayor a menor potencial comercial

Devuelve SOLO JSON:
{
  "sector": "${sector}",
  "ideas": [
    {
      "nombre": "nombre comercial del servicio (máx 5 palabras)",
      "descripcion": "qué es exactamente y qué problema resuelve",
      "porque_funciona": "por qué este sector LO NECESITA ahora mismo",
      "precio_orientativo": "rango en euros (ej: 400-800€ / mes o proyecto)",
      "pitch": "cómo lo venderías en una frase al dueño del negocio",
      "urgencia": "alta|media|baja",
      "esfuerzo_implementacion": "alto|medio|bajo",
      "tecnologia": "tecnología o herramienta principal necesaria"
    }
  ]
}`,
    }],
  })

  try {
    const text = (msg.content[0] as any).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const resultado = JSON.parse(jsonMatch?.[0] ?? text)
    return NextResponse.json({ ok: true, ...resultado })
  } catch {
    return NextResponse.json({ error: 'Error al parsear ideas de IA' }, { status: 500 })
  }
}
