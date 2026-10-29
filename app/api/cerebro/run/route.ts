import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { differenceInHours, differenceInMinutes } from 'date-fns'

export const maxDuration = 300

async function getConfig(clave: string): Promise<string | null> {
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [habilitado, ultimaEjecucion, ultimoResultado, sector, ciudad, ultimoNeg, ultimoPip, ultimoRes, ultimoSeg] =
    await Promise.all([
      getConfig('cerebro_habilitado'),
      getConfig('cerebro_ultima_ejecucion'),
      getConfig('cerebro_ultimo_resultado'),
      getConfig('cerebro_sector'),
      getConfig('cerebro_ciudad'),
      getConfig('cerebro_ultima_negociador'),
      getConfig('cerebro_ultimo_pipeline'),
      getConfig('cerebro_ultimo_resumen'),
      getConfig('cerebro_ultimo_seguimiento'),
    ])

  const now = new Date()
  const toMins = (iso: string | null, horas: number) =>
    iso ? Math.max(0, horas * 60 - differenceInMinutes(now, new Date(iso))) : 0

  return NextResponse.json({
    habilitado: habilitado === 'true',
    ultimaEjecucion: ultimaEjecucion ?? null,
    ultimoResultado: ultimoResultado ? JSON.parse(ultimoResultado) : null,
    sector: sector ?? 'Restaurantes',
    ciudad: ciudad ?? 'Zaragoza',
    agentes: {
      negociador: {
        ultimaEjecucion: ultimoNeg ?? null,
        intervaloMinutos: 30,
        minutosParaProxima: toMins(ultimoNeg, 0.5),
        listo: !ultimoNeg || differenceInMinutes(now, new Date(ultimoNeg)) >= 30,
      },
      pipeline: {
        ultimaEjecucion: ultimoPip ?? null,
        intervaloHoras: 6,
        minutosParaProxima: toMins(ultimoPip, 6),
        listo: !ultimoPip || differenceInHours(now, new Date(ultimoPip)) >= 6,
      },
      resumen: {
        ultimaEjecucion: ultimoRes ?? null,
        intervaloHoras: 20,
        minutosParaProxima: toMins(ultimoRes, 20),
        listo: !ultimoRes || differenceInHours(now, new Date(ultimoRes)) >= 20,
      },
      seguimiento: {
        ultimaEjecucion: ultimoSeg ?? null,
        intervaloHoras: 24,
        minutosParaProxima: toMins(ultimoSeg, 24),
        listo: !ultimoSeg || differenceInHours(now, new Date(ultimoSeg)) >= 24,
      },
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // ── Toggle habilitado ─────────────────────────────────────────────────────────
  if (body.setHabilitado !== undefined) {
    await setConfig('cerebro_habilitado', body.setHabilitado ? 'true' : 'false')
    return NextResponse.json({ ok: true, habilitado: body.setHabilitado })
  }

  // ── Actualizar configuración ──────────────────────────────────────────────────
  const configUpdates: Promise<any>[] = []
  if (body.setSector) configUpdates.push(setConfig('cerebro_sector', body.setSector))
  if (body.setCiudad) configUpdates.push(setConfig('cerebro_ciudad', body.setCiudad))
  if (configUpdates.length) await Promise.all(configUpdates)
  if (body.configOnly) return NextResponse.json({ ok: true })

  // ── Comprobar si está habilitado ──────────────────────────────────────────────
  const habilitado = await getConfig('cerebro_habilitado')
  if (habilitado !== 'true' && !body.force) {
    return NextResponse.json({ skipped: true, razon: 'Cerebro desactivado', acciones: [] })
  }

  const now = new Date()
  const sector = (await getConfig('cerebro_sector')) ?? 'Restaurantes'
  const ciudad = (await getConfig('cerebro_ciudad')) ?? 'Zaragoza'
  const acciones: Array<{ agente: string; resultado: string; ok: boolean }> = []

  // ── URL base para llamadas internas ──────────────────────────────────────────
  const cookieHeader = req.headers.get('cookie') ?? ''
  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = `${proto}://${host}`

  // ── Negociador — cada 30 minutos ──────────────────────────────────────────────
  const ultimoNeg = await getConfig('cerebro_ultima_negociador')
  const debeNeg = !ultimoNeg || differenceInMinutes(now, new Date(ultimoNeg)) >= 30
  if (debeNeg) {
    try {
      const res = await fetch(`${base}/api/agentes/negociador`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
        signal: AbortSignal.timeout(60_000),
      })
      const data = await res.json()
      await setConfig('cerebro_ultima_negociador', now.toISOString())
      acciones.push({
        agente: 'Negociador',
        resultado: data.error
          ? `Error: ${data.error}`
          : `${data.respondidos ?? 0} respondidos · ${data.delegados ?? 0} delegados · ${data.rebotes ?? 0} rebotes`,
        ok: !data.error,
      })
    } catch (e: any) {
      acciones.push({ agente: 'Negociador', resultado: `Error: ${e.message}`, ok: false })
    }
  }

  // ── Pipeline — cada 6 horas ───────────────────────────────────────────────────
  const ultimoPip = await getConfig('cerebro_ultimo_pipeline')
  const debePip = !ultimoPip || differenceInHours(now, new Date(ultimoPip)) >= 6
  if (debePip) {
    try {
      const res = await fetch(`${base}/api/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ sector, ciudad, maxResultados: 20 }),
        signal: AbortSignal.timeout(150_000),
      })
      const data = await res.json()
      await setConfig('cerebro_ultimo_pipeline', now.toISOString())
      acciones.push({
        agente: 'Pipeline',
        resultado: data.error
          ? `Error: ${data.error}`
          : `${data.paso1_leads ?? 0} leads nuevos · ${data.paso3_enviados ?? 0} emails enviados · "${data.varianteUsada ?? sector}"`,
        ok: data.ok === true,
      })
    } catch (e: any) {
      acciones.push({ agente: 'Pipeline', resultado: `Error: ${e.message}`, ok: false })
    }
  }

  // ── Resumen diario — cada 20 horas ────────────────────────────────────────────
  const ultimoRes = await getConfig('cerebro_ultimo_resumen')
  const debeRes = !ultimoRes || differenceInHours(now, new Date(ultimoRes)) >= 20
  if (debeRes) {
    try {
      const res = await fetch(`${base}/api/agentes/resumen-diario`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
        signal: AbortSignal.timeout(30_000),
      })
      const data = await res.json()
      await setConfig('cerebro_ultimo_resumen', now.toISOString())
      acciones.push({
        agente: 'Resumen Diario',
        resultado: data.error ? `Error: ${data.error}` : 'Resumen generado correctamente',
        ok: !!data.resumen,
      })
    } catch (e: any) {
      acciones.push({ agente: 'Resumen Diario', resultado: `Error: ${e.message}`, ok: false })
    }
  }

  // ── Seguimiento automático — cada 24 horas ────────────────────────────────────
  const ultimoSeg = await getConfig('cerebro_ultimo_seguimiento')
  const debeSeg = !ultimoSeg || differenceInHours(now, new Date(ultimoSeg)) >= 24
  if (debeSeg) {
    try {
      const res = await fetch(`${base}/api/agentes/seguimiento-auto`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
        signal: AbortSignal.timeout(90_000),
      })
      const data = await res.json()
      await setConfig('cerebro_ultimo_seguimiento', now.toISOString())
      acciones.push({
        agente: 'Seguimiento',
        resultado: data.error
          ? `Error: ${data.error}`
          : `${data.enviados?.length ?? 0} seguimientos enviados · ${data.omitidos?.length ?? 0} omitidos`,
        ok: data.ok === true,
      })
    } catch (e: any) {
      acciones.push({ agente: 'Seguimiento', resultado: `Error: ${e.message}`, ok: false })
    }
  }

  if (acciones.length === 0) {
    return NextResponse.json({ ok: true, acciones: [], skipped: true, razon: 'Todos los agentes están al día' })
  }

  const resultado = { timestamp: now.toISOString(), acciones, sector, ciudad }
  await setConfig('cerebro_ultima_ejecucion', now.toISOString())
  await setConfig('cerebro_ultimo_resultado', JSON.stringify(resultado))

  return NextResponse.json({ ok: true, ...resultado })
}
