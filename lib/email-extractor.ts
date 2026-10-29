const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const EXCLUDE_DOMAINS = ['example.com', 'sentry.io', 'wix.com', 'wordpress.com', 'google.com', 'facebook.com', 'instagram.com', 'w3.org', 'schema.org', 'cloudflare.com', 'jquery.com', 'amazonaws.com', 'googletagmanager.com']
const EXCLUDE_PREFIXES = ['noreply', 'no-reply', 'donotreply']
const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|avif)$/i

function cleanHtml(html: string) {
  return html
    .replace(/&#64;/g, '@').replace(/&#x40;/g, '@')
    .replace(/\[at\]/gi, '@').replace(/\(at\)/gi, '@').replace(/\[arroba\]/gi, '@')
}

function extractEmails(html: string): string[] {
  return [...new Set(cleanHtml(html).match(EMAIL_RE) ?? [])].filter((m) => {
    const lower = m.toLowerCase()
    const d = lower.split('@')[1] ?? ''
    if (IMAGE_EXTS.test(lower)) return false          // filtrar nombres de imagen
    if (d.includes('@')) return false                  // doble @
    if (EXCLUDE_DOMAINS.some((x) => d.includes(x))) return false
    if (EXCLUDE_PREFIXES.some((p) => lower.startsWith(p))) return false
    if (!/^[a-z]{2,}$/.test(d.split('.').pop() ?? '')) return false  // extensión TLD inválida
    return d.length >= 4
  }).map((m) => m.toLowerCase())
}

function pickBestEmail(emails: string[], domain: string): string | null {
  if (!emails.length) return null
  const short = domain.replace(/^www\./, '').split('.')[0]
  return (
    emails.find((e) => e.includes(short)) ??
    emails.find((e) => /^(info|contacto|contact|hola|reservas)@/.test(e)) ??
    emails[0]
  )
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Chrome/120)', 'Accept-Language': 'es-ES,es;q=0.9' },
      redirect: 'follow',
    })
    return res.ok ? res.text() : null
  } catch { return null }
}

export async function extractEmailFromWeb(rawUrl: string): Promise<string | null> {
  if (!rawUrl.startsWith('http')) rawUrl = `https://${rawUrl}`
  let domain: string
  try { domain = new URL(rawUrl).hostname } catch { return null }

  const base = rawUrl.replace(/\/$/, '')
  for (const path of ['', '/contacto', '/contact', '/aviso-legal']) {
    const html = await fetchHtml(`${base}${path}`)
    if (!html) continue
    const pick = pickBestEmail(extractEmails(html), domain)
    if (pick) return pick
  }
  return null
}
