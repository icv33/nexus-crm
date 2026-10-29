import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/calendar.events',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.provider === 'google') {
        token.googleToken = account.access_token
        token.googleRefreshToken = account.refresh_token
        token.googleTokenExpiry = account.expires_at
        token.accessToken = account.access_token
        if (user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: { id: true },
            })
            if (dbUser) token.dbUserId = dbUser.id
          } catch {}
        }
      }

      // Renovar token si expira en menos de 60s
      if (
        token.googleRefreshToken &&
        token.googleTokenExpiry &&
        Math.floor(Date.now() / 1000) > (token.googleTokenExpiry as number) - 60
      ) {
        try {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.googleRefreshToken as string,
            }),
          })
          const refreshed = await res.json()
          if (refreshed.access_token) {
            token.googleToken = refreshed.access_token
            token.accessToken = refreshed.access_token
            token.googleTokenExpiry =
              Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600)
          }
        } catch {}
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.googleToken as string | undefined
      session.googleToken = token.googleToken as string | undefined
      if (token.dbUserId) session.user = { ...session.user, id: token.dbUserId as string }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // Solo entra el dueño del CRM
        if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) return false
      }
      if (account?.provider === 'google' && user.email) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: { name: user.name || user.email, image: user.image || null },
            create: {
              email: user.email,
              name: user.name || user.email,
              image: user.image || null,
            },
          })
          if (account.refresh_token) {
            await prisma.configuracion.upsert({
              where: { clave: 'google_refresh_token' },
              update: { valor: account.refresh_token },
              create: { clave: 'google_refresh_token', valor: account.refresh_token, tipo: 'string', descripcion: 'Google refresh token para cron autónomo' },
            })
          }
        } catch {}
      }
      return true
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
}
