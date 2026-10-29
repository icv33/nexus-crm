import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { extractEmailFromWeb } from '@/lib/email-extractor'

export const maxDuration = 300

const MAPS_KEY = () => {
  const k = process.env.GOOGLE_MAPS_API_KEY
  if (!k || k === 'TU_MAPS_KEY_AQUI') throw new Error('GOOGLE_MAPS_API_KEY no configurada. Añádela en .env.local')
  return k
}

async function textSearch(query: string, maxResults: number): Promise<any[]> {
  const all: any[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 3; page++) {
    if (all.length >= maxResults) break

    const base = `https://maps.googleapis.com/maps/api/place/textsearch/json`
    const params = new URLSearchParams({ query, language: 'es', region: 'es', key: MAPS_KEY() })
    if (pageToken) params.set('pagetoken', pageToken)

    const res = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(15_000) })
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places: ${data.status} — ${data.error_message ?? 'error desconocido'}`)
    }

    all.push(...(data.results ?? []))
    pageToken = data.next_page_token

    if (!pageToken) break
    // Google requiere ~2s entre páginas para que el token sea válido
    await new Promise((r) => setTimeout(r, 2000))
  }

  return all.slice(0, maxResults)
}

async function getDetails(placeId: string): Promise<any> {
  const fields = [
    'name', 'website', 'formatted_phone_number', 'international_phone_number',
    'rating', 'user_ratings_total', 'opening_hours', 'price_level',
    'formatted_address', 'types',
  ].join(',')
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=es&key=${MAPS_KEY()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const data = await res.json()
  return data.result ?? {}
}

function calcularScore(d: any): number {
  let score = 5

  // Presencia web: señal más fuerte
  if (!d.website) score += 3
  else score -= 1

  // Visibilidad en Google
  const reviews = d.user_ratings_total ?? 0
  const rating = d.rating ?? 0
  if (reviews < 10) score += 2
  else if (reviews < 30) score += 1
  else if (reviews > 200) score -= 1

  // Rating bajo = gestión de reputación mejorable
  if (rating > 0 && rating < 3.5) score += 1

  // Sin teléfono = poco contactable
  if (!d.formatted_phone_number && !d.international_phone_number) score += 1

  // Sin horarios online = mala UX
  if (!d.opening_hours) score += 0.5

  // Nivel de precio bajo → puede que no inviertan en digital
  if (d.price_level === 1) score += 0.5

  return Math.min(10, Math.max(1, Math.round(score)))
}

function generarProblema(d: any, nombre: string, sector: string): string {
  const fallos: string[] = []
  if (!d.website) fallos.push('sin página web propia')
  if (!d.formatted_phone_number) fallos.push('teléfono no visible en Google')
  if (!d.opening_hours) fallos.push('horarios no publicados online')

  const reviews = d.user_ratings_total ?? 0
  if (reviews < 20) fallos.push(`solo ${reviews} reseñas en Google (muy poca visibilidad)`)

  if (fallos.length === 0) {
    return `${nombre} tiene presencia digital pero puede mejorar con automatización de reservas y captación de clientes.`
  }
  return `${nombre} (${sector}): ${fallos.slice(0, 3).join(', ')}. ${reviews < 20 ? 'Negocio con potencial pero casi invisible online.' : 'Oportunidad clara de mejora digital.'}`
}

function inferirServicio(d: any, sector: string): string {
  if (!d.website) return 'web'
  const types: string[] = d.types ?? []
  const sL = sector.toLowerCase()
  if (types.includes('restaurant') || types.includes('bar') || sL.includes('restaurante')) return 'sistema_reservas'
  if (types.includes('dentist') || types.includes('doctor') || sL.includes('clinica')) return 'automatizacion_formularios'
  if (types.includes('hair_care') || types.includes('beauty_salon') || sL.includes('peluquer')) return 'automatizacion_formularios'
  return 'mejora_web'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { sector, ciudad, maxResultados = 10 } = await req.json()
  if (!sector || !ciudad) return NextResponse.json({ error: 'Faltan sector y ciudad' }, { status: 400 })

  const agente = await prisma.agente.findFirst({ where: { tipo: 'prospeccion' } })

  try {
    const query = `${sector} en ${ciudad}`
    const lugares = await textSearch(query, maxResultados)

    let creados = 0
    let omitidos = 0
    const leadsCreados: string[] = []

    for (const lugar of lugares) {
      if (creados >= maxResultados) break

      const existente = await prisma.lead.findFirst({
        where: { nombre: { equals: lugar.name, mode: 'insensitive' } },
      })
      if (existente) { omitidos++; continue }

      // Obtener detalles completos
      const d = await getDetails(lugar.place_id)
      const nombre = d.name ?? lugar.name

      const puntuacion = calcularScore(d)
      const problemaDetectado = generarProblema(d, nombre, sector)
      const servicioRecomendado = inferirServicio(d, sector)
      const prioridad: 'alta' | 'media' | 'baja' = puntuacion >= 7 ? 'alta' : puntuacion >= 5 ? 'media' : 'baja'

      const notas = [
        d.rating ? `⭐ ${d.rating}/5 (${d.user_ratings_total ?? 0} reseñas en Google)` : null,
        d.price_level ? `Nivel de precio: ${'€'.repeat(d.price_level)}` : null,
        d.formatted_address ?? null,
      ].filter(Boolean).join(' · ')

      // Intentar extraer email de la web antes de crear el lead
      const emailExtraido = d.website ? await extractEmailFromWeb(d.website) : null

      const lead = await prisma.lead.create({
        data: {
          nombre,
          sector,
          ciudad,
          web: d.website ?? null,
          email: emailExtraido ?? null,
          telefono: d.formatted_phone_number ?? d.international_phone_number ?? null,
          fuente: 'google_maps',
          problemaDetectado,
          servicioRecomendado,
          puntuacion,
          prioridad,
          estado: 'analizado',
          notas: notas || undefined,
        },
      })

      await prisma.actividad.create({
        data: {
          tipo: 'lead_creado',
          descripcion: `Agente Prospección (Google Maps): ${lead.nombre}${d.rating ? ` · ⭐${d.rating}` : ''}`,
          leadId: lead.id,
          agenteId: agente?.id,
        },
      })

      leadsCreados.push(lead.nombre)
      creados++
    }

    if (agente) {
      await prisma.agente.update({
        where: { id: agente.id },
        data: { ultimaEjecucion: new Date() },
      })
      await prisma.agenteLog.create({
        data: {
          agenteId: agente.id,
          mensaje: `Prospección Google Maps: ${creados} leads creados, ${omitidos} omitidos`,
          metadata: { sector, ciudad, maxResultados, creados, omitidos, leads: leadsCreados } as any,
        },
      })
    }

    return NextResponse.json({ ok: true, creados, omitidos, leads: leadsCreados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
