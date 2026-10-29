import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { idea, negocio, sector, ciudad } = await req.json()
  if (!idea) return NextResponse.json({ error: 'Falta la idea del email' }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Eres un experto en ventas B2B para Nexus Digital (empresa de automatización e IA para negocios locales).
Reescribe la siguiente idea como un email de prospección profesional manteniendo el mismo tono y estilo que usas normalmente.

NEGOCIO DESTINATARIO:
- Nombre: ${negocio ?? 'el negocio'}
- Sector: ${sector ?? 'negocio local'}
- Ciudad: ${ciudad ?? 'Zaragoza'}

IDEA O BORRADOR DEL USUARIO:
${idea}

REGLAS:
- Mantén el tono profesional pero cercano, español de España
- No menciones precios ni plazos
- Máximo 200 palabras
- Termina con CTA para una llamada de 15 minutos
- Firma: "Ignacio, fundador de Nexus Digital"
- Devuelve SOLO el texto del email, sin asunto, sin markdown`,
    }],
  })

  const email = (msg.content[0] as any).text.trim()
  return NextResponse.json({ ok: true, email })
}
