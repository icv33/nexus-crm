import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { extractEmailFromWeb } from '@/lib/email-extractor'
import { randomUUID } from 'crypto'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://nexus-plum-tau.vercel.app'
const EMAIL_BATCH_LIMIT = 20
function dentroVentanaHoraria(): boolean {
  const hora = parseInt(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(new Date()))
  return hora >= 9 && hora < 18
}

// Permite hasta 5 minutos de ejecución en Vercel (hobby: 60s, pro: 300s)
export const maxDuration = 300

// ─── Config ──────────────────────────────────────────────────────────────────
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!

// ─── Variantes de búsqueda por sector ────────────────────────────────────────
// Fallbacks hardcodeados para sectores comunes. Para sectores desconocidos,
// Claude genera las variantes y las cachea en DB.

const SECTOR_FALLBACKS: Record<string, string[]> = {
  restaurante:  ['Restaurante', 'Bar', 'Cafetería', 'Taberna', 'Bodega', 'Marisquería', 'Pizzería', 'Tapas', 'Bistró', 'Asador', 'Hamburguesería', 'Kebab'],
  bar:          ['Bar', 'Pub', 'Cafetería', 'Taberna', 'Cervecería', 'Tasca', 'Cóctelería', 'Vermutería'],
  peluquería:   ['Peluquería', 'Barbería', 'Salón de belleza', 'Centro de estética', 'Spa', 'Uñas', 'Micropigmentación'],
  clínica:      ['Clínica dental', 'Dentista', 'Clínica médica', 'Centro médico', 'Fisioterapia', 'Psicólogo', 'Nutricionista', 'Podólogo'],
  tienda:       ['Tienda', 'Comercio', 'Boutique', 'Papelería', 'Ferretería', 'Floristería', 'Librería', 'Zapatería'],
  gimnasio:     ['Gimnasio', 'Centro deportivo', 'Pilates', 'CrossFit', 'Yoga', 'Boxeo', 'Natación', 'Artes marciales'],
  hotel:        ['Hotel', 'Hostal', 'Apartamento turístico', 'Pensión', 'Casa rural', 'Albergue'],
  farmacia:     ['Farmacia', 'Parafarmacia', 'Herbolario', 'Óptica', 'Ortopedia'],
  fontanero:    ['Fontanero', 'Electricista', 'Albañil', 'Pintor', 'Carpintero', 'Cerrajero', 'Reformas', 'Instalaciones'],
  abogado:      ['Abogado', 'Gestoría', 'Asesoría', 'Notaría', 'Consultoría', 'Economista', 'Graduado social'],
  academia:     ['Academia', 'Centro de formación', 'Autoescuela', 'Clases particulares', 'Idiomas', 'Informática'],
  veterinario:  ['Veterinario', 'Clínica veterinaria', 'Peluquería canina', 'Tienda de mascotas', 'Guardería canina'],
}

function getHardcodedVariants(sector: string): string[] | null {
  const key = sector.toLowerCase().trim()
  for (const [k, variants] of Object.entries(SECTOR_FALLBACKS)) {
    if (key.includes(k) || k.includes(key)) return variants
  }
  return null
}

async function getOrGenerateVariants(sector: string): Promise<string[]> {
  const cacheKey = `pipeline_variants_${sector.toLowerCase().replace(/\s+/g, '_')}`

  // 1. Intentar caché en DB (solo si tiene más de 2 variantes — descarta fallbacks corruptos)
  const cached = await prisma.configuracion.findUnique({ where: { clave: cacheKey } })
  if (cached) {
    try {
      const parsed = JSON.parse(cached.valor)
      if (Array.isArray(parsed) && parsed.length > 2) return parsed
    } catch { /* continuar */ }
  }

  // 2. Fallback hardcodeado para sectores comunes
  const hardcoded = getHardcodedVariants(sector)
  if (hardcoded) {
    await prisma.configuracion.upsert({
      where: { clave: cacheKey },
      update: { valor: JSON.stringify(hardcoded) },
      create: { clave: cacheKey, valor: JSON.stringify(hardcoded), tipo: 'json', descripcion: `Variantes para sector: ${sector}` },
    })
    return hardcoded
  }

  // 3. Claude para sectores desconocidos
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Sector de negocio: "${sector}". Devuelve SOLO un array JSON con 8-10 términos de búsqueda en español para Google Maps, incluyendo sinónimos, sub-tipos y negocios afines. Sin texto adicional. Ejemplo: ["Restaurante","Bar","Cafetería","Taberna"]`,
      }],
    })
    const text = (msg.content[0] as any).text.trim()
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length > 2) {
      await prisma.configuracion.upsert({
        where: { clave: cacheKey },
        update: { valor: JSON.stringify(parsed) },
        create: { clave: cacheKey, valor: JSON.stringify(parsed), tipo: 'json', descripcion: `Variantes IA para sector: ${sector}` },
      })
      return parsed
    }
  } catch { /* ignorar error de Claude */ }

  // 4. Último recurso: variaciones básicas del nombre
  const basic = [sector, `${sector} local`, `Pequeño ${sector}`]
  return basic
}

async function getVariantsState(sector: string, ciudad: string) {
  const variants = await getOrGenerateVariants(sector)
  const idxKey = `pipeline_idx_${sector.toLowerCase().replace(/\s+/g, '_')}_${ciudad.toLowerCase().replace(/\s+/g, '_')}`
  const idxConfig = await prisma.configuracion.findUnique({ where: { clave: idxKey } })
  const idx = parseInt(idxConfig?.valor ?? '0') % variants.length
  return { variants, idx, idxKey }
}

async function saveVariantIndex(idxKey: string, nextIdx: number) {
  await prisma.configuracion.upsert({
    where: { clave: idxKey },
    update: { valor: String(nextIdx) },
    create: { clave: idxKey, valor: String(nextIdx), tipo: 'number', descripcion: `Índice de búsqueda para pipeline` },
  })
}

// ─── Google Maps ──────────────────────────────────────────────────────────────
async function mapsTextSearch(query: string, max: number) {
  const all: any[] = []
  let pageToken: string | undefined
  for (let p = 0; p < 3 && all.length < max; p++) {
    const params = new URLSearchParams({ query, language: 'es', region: 'es', key: MAPS_KEY })
    if (pageToken) params.set('pagetoken', pageToken)
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { signal: AbortSignal.timeout(15_000) })
    const data = await res.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error(`Google Maps: ${data.status}`)
    all.push(...(data.results ?? []))
    pageToken = data.next_page_token
    if (!pageToken) break
    await new Promise((r) => setTimeout(r, 2000))
  }
  return all.slice(0, max)
}

async function mapsDetails(placeId: string) {
  const fields = 'name,website,formatted_phone_number,international_phone_number,rating,user_ratings_total,opening_hours,price_level,formatted_address,types'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=es&key=${MAPS_KEY}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const data = await res.json()
  return data.result ?? {}
}

function calcScore(d: any) {
  let s = 5
  if (!d.website) s += 3; else s -= 1
  const r = d.user_ratings_total ?? 0
  if (r < 10) s += 2; else if (r < 30) s += 1; else if (r > 200) s -= 1
  if (d.rating > 0 && d.rating < 3.5) s += 1
  if (!d.formatted_phone_number && !d.international_phone_number) s += 1
  if (!d.opening_hours) s += 0.5
  if (d.price_level === 1) s += 0.5
  return Math.min(10, Math.max(1, Math.round(s)))
}

function genProblema(d: any, nombre: string, sector: string) {
  const f: string[] = []
  if (!d.website) f.push('sin página web')
  if (!d.formatted_phone_number) f.push('teléfono no visible en Google')
  if (!d.opening_hours) f.push('horarios no publicados')
  const r = d.user_ratings_total ?? 0
  if (r < 20) f.push(`solo ${r} reseñas`)
  if (!f.length) return `${nombre} puede mejorar con automatización.`
  return `${nombre} (${sector}): ${f.slice(0, 3).join(', ')}.`
}

function inferServicio(d: any, sector: string) {
  if (!d.website) return 'web'
  const types: string[] = d.types ?? []
  const s = sector.toLowerCase()
  if (types.includes('restaurant') || types.includes('bar') || s.includes('restaurante')) return 'sistema_reservas'
  if (types.includes('dentist') || types.includes('doctor') || s.includes('clinica')) return 'automatizacion_formularios'
  if (types.includes('hair_care') || s.includes('peluquer')) return 'automatizacion_formularios'
  return 'mejora_web'
}

// ─── Email generation & sending ───────────────────────────────────────────────
async function generarEmail(lead: any): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Eres un experto en ventas B2B para una empresa de automatización e IA. Escribe un email de prospección en español para este negocio local.

NEGOCIO:
- Nombre: ${lead.nombre}
- Sector: ${lead.sector ?? 'desconocido'}
- Ciudad: ${lead.ciudad ?? 'Zaragoza'}
- Problema detectado: ${lead.problemaDetectado ?? 'presencia digital mejorable'}
- Servicio a ofrecer: ${lead.servicioRecomendado?.replace(/_/g, ' ') ?? 'digitalización'}

REGLAS:
- Tono profesional pero cercano, español de España
- NO menciones precios ni plazos
- Referencia específicamente su negocio y sector
- Máximo 180 palabras
- Termina con CTA para una llamada de 15 minutos
- Firma: "Ignacio, fundador de Nexus Digital"
- Devuelve SOLO el texto del email, sin asunto, sin markdown`,
    }],
  })
  return (msg.content[0] as any).text.trim()
}

async function enviarEmail(accessToken: string, to: string, subject: string, body: string, leadId: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const trackingId = randomUUID()
  const pixelUrl = `${APP_URL}/api/track/open?id=${trackingId}`
  const htmlContent = body
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:600px">${htmlContent}<img src="${pixelUrl}" width="1" height="1" style="display:none!important;visibility:hidden" alt="" /></body></html>`

  const boundary = `nexus_${Date.now()}`
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

  await prisma.email.create({ data: { leadId, gmailMessageId: res.data.id, gmailThreadId: res.data.threadId, tipo: 'enviado', asunto: subject, cuerpo: body, destinatario: to, fecha: new Date(), trackingId } })
  await prisma.lead.update({ where: { id: leadId }, data: { estado: 'contactado', emailEnviado: true, fechaEnvio: new Date(), ultimoContactoEn: new Date() } })
  await prisma.actividad.create({ data: { tipo: 'email_enviado', descripcion: `Email de prospección enviado a ${to}`, leadId } })
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions)
  const isCron = req.headers.get('x-cron') === process.env.CRON_SECRET
  if (!session && !isCron) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const accessToken = (session as any)?.googleToken ?? (session as any)?.accessToken ?? req.headers.get('x-google-token')
  if (!accessToken) return NextResponse.json({ error: 'Token de Google no disponible.' }, { status: 401 })

  const { sector = 'Restaurantes', ciudad = 'Zaragoza', maxResultados = 20 } = await req.json().catch(() => ({}))

  const result = { sector, ciudad, paso1_leads: 0, paso1_omitidos: 0, paso2_emails: 0, paso2_webs: 0, paso3_enviados: 0, paso3_errores: [] as string[], nuevosLeads: [] as string[], emailsEncontrados: [] as string[], enviados: [] as string[], varianteUsada: '' }

  // ── Paso 1: Buscar leads en Google Maps — rota variantes hasta encontrar nuevos ─
  const agente = await prisma.agente.findFirst({ where: { tipo: 'prospeccion' } })
  try {
    const { variants, idx: startIdx, idxKey } = await getVariantsState(sector, ciudad)
    const MAX_INTENTOS = Math.min(5, variants.length)

    let encontradosEnEsteIntento = 0
    let intentoActual = 0

    while (intentoActual < MAX_INTENTOS) {
      const currentIdx = (startIdx + intentoActual) % variants.length
      const varianteUsada = variants[currentIdx]
      const query = `${varianteUsada} en ${ciudad}`
      result.varianteUsada = varianteUsada

      const lugares = await mapsTextSearch(query, maxResultados)

      const paso1Results = await Promise.allSettled(
        lugares.map(async (lugar) => {
          // Comprobación rápida por nombre antes de llamar a Details
          const existentePorNombre = await prisma.lead.findFirst({ where: { nombre: { equals: lugar.name, mode: 'insensitive' } } })
          if (existentePorNombre) return { skipped: true as const }
          const d = await mapsDetails(lugar.place_id)
          const nombre = d.name ?? lugar.name
          // Comprobación definitiva por nombre final + web para evitar duplicados
          const existente = await prisma.lead.findFirst({
            where: {
              OR: [
                { nombre: { equals: nombre, mode: 'insensitive' } },
                ...(d.website ? [{ web: d.website }] : []),
              ],
            },
          })
          if (existente) return { skipped: true as const }
          const puntuacion = calcScore(d)
          const prioridad: 'alta' | 'media' | 'baja' = puntuacion >= 7 ? 'alta' : puntuacion >= 5 ? 'media' : 'baja'
          const notas = [d.rating ? `⭐ ${d.rating}/5 (${d.user_ratings_total ?? 0} reseñas)` : null, d.formatted_address ?? null].filter(Boolean).join(' · ')
          const lead = await prisma.lead.create({
            data: { nombre, sector, ciudad, web: d.website ?? null, telefono: d.formatted_phone_number ?? d.international_phone_number ?? null, fuente: 'google_maps', problemaDetectado: genProblema(d, nombre, sector), servicioRecomendado: inferServicio(d, sector), puntuacion, prioridad, estado: 'analizado', notas: notas || undefined },
          })
          await prisma.actividad.create({ data: { tipo: 'lead_creado', descripcion: `Pipeline: ${lead.nombre}${d.rating ? ` · ⭐${d.rating}` : ''}`, leadId: lead.id, agenteId: agente?.id } })
          return { lead }
        })
      )

      let nuevosEnEsteIntento = 0
      for (const r of paso1Results) {
        if (r.status === 'rejected') continue
        if ('skipped' in r.value) { result.paso1_omitidos++; continue }
        result.nuevosLeads.push(r.value.lead.nombre)
        result.paso1_leads++
        nuevosEnEsteIntento++
      }

      encontradosEnEsteIntento += nuevosEnEsteIntento
      intentoActual++

      // Guardar el índice avanzado tras este intento
      await saveVariantIndex(idxKey, (startIdx + intentoActual) % variants.length)

      // Si encontramos leads nuevos, parar aquí
      if (nuevosEnEsteIntento > 0) break
    }

    if (agente) await prisma.agente.update({ where: { id: agente.id }, data: { ultimaEjecucion: new Date() } })
  } catch (err: any) {
    return NextResponse.json({ ...result, error: `Paso 1 fallido: ${err.message}` }, { status: 500 })
  }

  // ── Paso 2: Extraer emails — solo leads nunca intentados (sin actividad email_encontrado) ──
  try {
    const leadsConWeb = await prisma.lead.findMany({
      where: {
        web: { not: null },
        email: null,
        actividades: { none: { tipo: 'email_encontrado' } },
      },
      orderBy: { puntuacion: 'desc' },
      take: 20,
    })
    result.paso2_webs = leadsConWeb.length

    const BATCH = 5
    for (let i = 0; i < leadsConWeb.length; i += BATCH) {
      const batch = leadsConWeb.slice(i, i + BATCH)
      const emailResults = await Promise.allSettled(batch.map((lead) => extractEmailFromWeb(lead.web!)))
      for (let j = 0; j < batch.length; j++) {
        const r = emailResults[j]
        const lead = batch[j]
        if (r.status === 'fulfilled' && r.value) {
          const email = r.value
          await prisma.lead.update({ where: { id: lead.id }, data: { email } })
          await prisma.actividad.create({ data: { tipo: 'email_encontrado', descripcion: `Email extraído de web: ${email}`, leadId: lead.id } })
          result.emailsEncontrados.push(`${lead.nombre} → ${email}`)
          result.paso2_emails++
        } else {
          // Marcar como intentado para no volver a procesar en ejecuciones futuras
          await prisma.actividad.create({ data: { tipo: 'email_encontrado', descripcion: 'Sin email en web', leadId: lead.id } })
        }
      }
    }
  } catch (err: any) {
    result.paso3_errores.push(`Paso 2 (emails): ${err.message}`)
  }

  // ── Paso 3: Enviar emails ─────────────────────────────────────────────────────
  if (!dentroVentanaHoraria()) {
    result.paso3_errores.push('Fuera de ventana horaria (9-18h Madrid)')
  } else {
    const leadsParaEnviar = await prisma.lead.findMany({
      where: { email: { not: null }, emailEnviado: false },
      orderBy: [{ puntuacion: 'desc' }, { prioridad: 'asc' }],
      take: EMAIL_BATCH_LIMIT,
    })

    for (const lead of leadsParaEnviar) {
      try {
        let body = lead.emailPreparado
        if (!body) {
          body = await generarEmail(lead)
          await prisma.lead.update({ where: { id: lead.id }, data: { emailPreparado: body } })
        }
        const subject = `Hola ${lead.nombre} — una idea para mejorar vuestra presencia digital`
        await enviarEmail(accessToken, lead.email!, subject, body, lead.id)
        result.enviados.push(lead.nombre)
        result.paso3_enviados++
        await new Promise((r) => setTimeout(r, 1500))
      } catch (err: any) {
        result.paso3_errores.push(`${lead.nombre}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: `Pipeline error: ${err.message}` }, { status: 500 })
  }
}

