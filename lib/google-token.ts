import { prisma } from '@/lib/prisma'

export async function getFreshGoogleAccessToken(): Promise<string | null> {
  const stored = await prisma.configuracion.findUnique({ where: { clave: 'google_refresh_token' } })
  if (!stored?.valor) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: stored.valor,
      }),
    })
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}
