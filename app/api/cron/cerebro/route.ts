import { NextRequest, NextResponse } from 'next/server'
import { getFreshGoogleAccessToken } from '@/lib/google-token'
import { prisma } from '@/lib/prisma'
import { differenceInHours, differenceInMinutes } from 'date-fns'
import { google } from 'googleapis'

const ALERT_EMAIL = process.env.ADMIN_EMAIL

async function sendAlertEmail(accessToken: string, fallos: Array<{ agente: string; resultado: string }>, timestamp: string) {
  const subject = `⚠️ Nexus: fallos en el cron (${new Date(timestamp).toLocaleString('es-ES')})`
  const lineas = fallos.map((f) => `• ${f.agente}: ${f.resultado}`).join('\n')
  const body = `Se han detectado errores en la ejecución automática del cerebro de Nexus.\n\nFALLOS:\n${lineas}\n\nTimestamp: ${timestamp}\n\n---\nNexus CRM · Alerta automática`
  const lines = [
    `To: ${ALERT_EMAIL}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url')
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

export const maxDuration = 300

const SECTORES_ROTACION = [
  'Restaurantes', 'Peluquerías', 'Clínicas dentales', 'Gimnasios',
  'Bares y cafeterías', 'Tiendas locales', 'Academias', 'Fontaneros y reformas',
  'Abogados y gestorías', 'Veterinarios', 'Hoteles y alojamientos', 'Farmacias',
]

async function getConfig(clave: string) {
  const c = await prisma.configuracion.findUnique({ where: { clave } })
  return c?.valor ?? null
}
async function setConfig(clave: string, valor: string) {
  await prisma.configuracion.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor, tipo: 'string' },
  })
}

// Vercel Cron llama a este endpoint con GET + Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const accessToken = await getFreshGoogleAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'No hay refresh token almacenado. Inicia sesión una vez en la app.' }, { status: 500 })
  }

  const habilitado = await getConfig('cerebro_habilitado')
  if (habilitado !== 'true') {
    return NextResponse.json({ skipped: true, razon: 'Cerebro desactivado' })
  }

  const now = new Date()
  const ciudad = (await getConfig('cerebro_ciudad')) ?? 'Zaragoza'
  const acciones: Array<{ agente: string; resultado: string; ok: boolean }> = []
  let sector = 'Restaurantes'

  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = `${proto}://${host}`
  const cronHeaders = {
    'Content-Type': 'application/json',
    'x-cron': process.env.CRON_SECRET!,
    'x-google-token': accessToken,
  }

  // ── Negociador — cada 30 minutos ────────────────────────────────────────────
  const ultimoNeg = await getConfig('cerebro_ultima_negociador')
  if (!ultimoNeg || differenceInMinutes(now, new Date(ultimoNeg)) >= 30) {
    try {
      const res = await fetch(`${base}/api/agentes/negociador`, { method: 'POST', headers: cronHeaders, signal: AbortSignal.timeout(60_000) })
      const data = await res.json()
      await setConfig('cerebro_ultima_negociador', now.toISOString())
      acciones.push({ agente: 'Negociador', resultado: data.error ? `Error: ${data.error}` : `${data.respondidos ?? 0} respondidos · ${data.delegados ?? 0} delegados`, ok: !data.error })
    } catch (e: any) { acciones.push({ agente: 'Negociador', resultado: `Error: ${e.message}`, ok: false }) }
  }

  // ── Pipeline — cada 6 horas ─────────────────────────────────────────────────
  const ultimoPip = await getConfig('cerebro_ultimo_pipeline')
  if (!ultimoPip || differenceInHours(now, new Date(ultimoPip)) >= 6) {
    try {
      // Rotar sector automáticamente
      const sectorIdxStr = await getConfig('cerebro_sector_idx')
      const sectorIdx = parseInt(sectorIdxStr ?? '0') % SECTORES_ROTACION.length
      sector = SECTORES_ROTACION[sectorIdx]
      await setConfig('cerebro_sector_idx', String((sectorIdx + 1) % SECTORES_ROTACION.length))
      await setConfig('cerebro_sector', sector)

      const res = await fetch(`${base}/api/pipeline/run`, { method: 'POST', headers: cronHeaders, body: JSON.stringify({ sector, ciudad, maxResultados: 10 }), signal: AbortSignal.timeout(240_000) })
      const data = await res.json()
      await setConfig('cerebro_ultimo_pipeline', now.toISOString())
      acciones.push({ agente: 'Pipeline', resultado: data.error ? `Error: ${data.error}` : `[${sector}] ${data.paso1_leads ?? 0} leads · ${data.paso3_enviados ?? 0} emails`, ok: data.ok === true })
    } catch (e: any) { acciones.push({ agente: 'Pipeline', resultado: `Error: ${e.message}`, ok: false }) }
  }

  // ── Seguimiento — cada 24 horas ─────────────────────────────────────────────
  const ultimoSeg = await getConfig('cerebro_ultimo_seguimiento')
  if (!ultimoSeg || differenceInHours(now, new Date(ultimoSeg)) >= 24) {
    try {
      const res = await fetch(`${base}/api/agentes/seguimiento-auto`, { method: 'POST', headers: cronHeaders, signal: AbortSignal.timeout(90_000) })
      const data = await res.json()
      await setConfig('cerebro_ultimo_seguimiento', now.toISOString())
      acciones.push({ agente: 'Seguimiento', resultado: data.error ? `Error: ${data.error}` : `${data.enviados?.length ?? 0} enviados`, ok: data.ok === true })
    } catch (e: any) { acciones.push({ agente: 'Seguimiento', resultado: `Error: ${e.message}`, ok: false }) }
  }

  if (acciones.length === 0) return NextResponse.json({ ok: true, skipped: true, razon: 'Todos al día' })

  const resultado = { timestamp: now.toISOString(), acciones, sector, ciudad }
  await setConfig('cerebro_ultima_ejecucion', now.toISOString())
  await setConfig('cerebro_ultimo_resultado', JSON.stringify(resultado))

  // ── Alerta por email si hay fallos (máx 1 por hora) ──────────────────────────
  const fallos = acciones.filter((a) => !a.ok)
  if (fallos.length > 0) {
    try {
      const ultimaAlerta = await getConfig('cerebro_ultima_alerta')
      const puedeEnviar = !ultimaAlerta || differenceInHours(now, new Date(ultimaAlerta)) >= 1
      if (puedeEnviar) {
        await sendAlertEmail(accessToken, fallos, now.toISOString())
        await setConfig('cerebro_ultima_alerta', now.toISOString())
      }
    } catch { /* no bloquear si falla el envío de alerta */ }
  }

  return NextResponse.json({ ok: true, ...resultado })
}
