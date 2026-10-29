'use client'

import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '11px',
  color: 'hsl(var(--foreground))',
}

export function DashboardCharts() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/charts')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-52 rounded-xl bg-card border border-border animate-pulse" />
        <div className="h-52 rounded-xl bg-card border border-border animate-pulse" />
      </div>
    )
  }

  const actividad: any[] = data?.actividadSemanal ?? []
  const sectores: any[] = data?.sectores ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Actividad semanal */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium mb-4">Actividad semanal — últimas 8 semanas</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={actividad} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradEmails" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="semana" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'hsl(var(--border))' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="url(#gradLeads)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="emails" name="Emails" stroke="#34d399" fill="url(#gradEmails)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sectores */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium mb-4">Leads por sector — top 7</p>
        {sectores.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">Sin datos todavía</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sectores} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--secondary))' }} />
              <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
