import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-primary" stroke="currentColor" strokeWidth={1.5}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Nexus</h1>
            <p className="text-sm text-muted-foreground mt-1">Centro de mando · Empresa IA</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
          <h2 className="text-sm font-medium text-center mb-1">Acceder al sistema</h2>
          <p className="text-xs text-muted-foreground text-center mb-6">
            Solo disponible para el administrador
          </p>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Acceso restringido · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
