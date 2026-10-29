import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const TIPOS: Record<string, { label: string; instruccion: string; maxTokens: number }> = {
  landing_page: {
    label: 'Landing Page',
    instruccion: `Genera el copy completo de una landing page con estas secciones:
1. HERO: Título impactante (máx 8 palabras) + Subtítulo (máx 20 palabras) + CTA
2. PROBLEMA: Agita el dolor del cliente en 2-3 frases
3. SOLUCIÓN: Cómo lo resolvemos en 3 puntos concretos
4. BENEFICIOS: 3 beneficios con iconos emoji
5. CTA FINAL: Oferta irresistible + urgencia
Formato: usa "## Sección" para separar.`,
    maxTokens: 1500,
  },
  instagram: {
    label: 'Post Instagram',
    instruccion: `Genera:
1. CAPTION: Post atractivo (máx 150 palabras) con hooks al inicio, valor en el medio, CTA al final. Usa emojis estratégicamente.
2. HASHTAGS: 20 hashtags relevantes (mix: populares, nicho, locales)
3. STORY: Guión para Stories de 3 slides (slide 1: gancho, slide 2: valor, slide 3: CTA)`,
    maxTokens: 700,
  },
  linkedin: {
    label: 'Post LinkedIn',
    instruccion: `Genera un post profesional de LinkedIn (máx 200 palabras).
Estructura:
- Primera línea: hook que genere curiosidad o sorpresa
- Desarrollo: historia o dato que aporte valor
- Conclusión + aprendizaje
- CTA sutil
Tono: profesional pero humano, sin jerga corporativa.`,
    maxTokens: 500,
  },
  email_campana: {
    label: 'Email de Campaña',
    instruccion: `Genera un email de prospección completo:
ASUNTO: (máx 50 chars, sin clickbait)
PREVIEW TEXT: (máx 80 chars, complementa el asunto)
CUERPO: (máx 120 palabras: apertura personalizada, dolor concreto, solución breve, CTA claro)
FIRMA: Ignacio | Nexus Digital | nexusdigital.es
Formato: etiquetas claras para cada parte.`,
    maxTokens: 600,
  },
  slogan: {
    label: 'Slogans',
    instruccion: `Genera 6 opciones de slogan/tagline para este negocio:
1. RACIONAL: beneficio claro y medible
2. EMOCIONAL: conecta con aspiraciones del cliente
3. CON NÚMEROS: usa un dato o estadística
4. DE URGENCIA: crea sensación de que actuar ahora importa
5. DE IDENTIDAD: define quiénes son como negocio
6. MEMORABLE: corto, rítmico, fácil de recordar
Cada slogan: máx 7 palabras. Indica el tipo y el slogan en líneas separadas.`,
    maxTokens: 400,
  },
  pitch: {
    label: 'Pitch de Ventas',
    instruccion: `Genera 2 versiones de pitch de ventas:
1. PITCH TELEFÓNICO (30 segundos / 70 palabras): para llamada en frío. Natural, sin sonar a script.
2. PITCH PRESENCIAL (60 segundos / 120 palabras): para visita o evento de networking. Más detallado, con historia.
Formato: etiquetas claras para cada versión.`,
    maxTokens: 500,
  },
  guion_video: {
    label: 'Guión de Vídeo',
    instruccion: `Genera el guión completo para un vídeo de 60 segundos (máx 150 palabras habladas):
- Segundos 0-5: gancho visual + pregunta que enganche
- Segundos 5-30: problema y agitación
- Segundos 30-50: solución y demostración
- Segundos 50-60: CTA claro
Incluye también: título del vídeo (SEO) + descripción corta (máx 50 palabras).`,
    maxTokens: 600,
  },
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo = 'instagram', negocio = '', sector = '', detalles = '' } = await req.json().catch(() => ({}))

  const config = TIPOS[tipo] ?? TIPOS.instagram

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: config.maxTokens,
    messages: [{
      role: 'user',
      content: `Eres copywriter experto en marketing digital para negocios locales en España. Dominas la persuasión y el español coloquial profesional.

NEGOCIO/CLIENTE: ${negocio || 'Nexus Digital (agencia de automatización e IA para negocios locales)'}
SECTOR OBJETIVO: ${sector || 'negocios locales en general'}
DETALLES ADICIONALES: ${detalles || 'Ayudamos a pequeños negocios a digitalizarse, automatizar procesos y conseguir más clientes con IA.'}

TAREA: ${config.instruccion}

Escribe en español de España, natural y cercano. Devuelve SOLO el contenido listo para usar, sin metadatos ni explicaciones.`,
    }],
  })

  const contenido = (msg.content[0] as any).text.trim()
  return NextResponse.json({ ok: true, tipo, label: config.label, contenido })
}
