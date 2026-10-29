import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    googleToken?: string
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    googleToken?: string
    googleRefreshToken?: string
    googleTokenExpiry?: number
    accessToken?: string
    dbUserId?: string
  }
}
