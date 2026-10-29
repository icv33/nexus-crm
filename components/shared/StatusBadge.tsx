import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  nuevo:                    { label: 'Nuevo',               className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  analizado:                { label: 'Analizado',           className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  descartado:               { label: 'Descartado',          className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  preparado_para_contactar: { label: 'Listo contactar',     className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  contactado:               { label: 'Contactado',          className: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  respondio:                { label: 'Respondió',           className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  interesado:               { label: 'Interesado',          className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  reunion_agendada:         { label: 'Reunión agendada',    className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  propuesta_pendiente:      { label: 'Prop. pendiente',     className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  propuesta_enviada:        { label: 'Prop. enviada',       className: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
  negociacion:              { label: 'Negociación',         className: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  perdido:                  { label: 'Perdido',             className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ganado:                   { label: 'Ganado',              className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  // Propuestas
  borrador:                 { label: 'Borrador',            className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  pendiente_aprobacion:     { label: 'Pend. aprobación',   className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  enviada:                  { label: 'Enviada',             className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  aceptada:                 { label: 'Aceptada',            className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rechazada:                { label: 'Rechazada',           className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  // Proyectos
  activo:                   { label: 'Activo',              className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  pausado:                  { label: 'Pausado',             className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  completado:               { label: 'Completado',          className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  cancelado:                { label: 'Cancelado',           className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  // Tareas
  pendiente:                { label: 'Pendiente',           className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  en_progreso:              { label: 'En progreso',         className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completada:               { label: 'Completada',          className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  cancelada:                { label: 'Cancelada',           className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  // Agentes
  error:                    { label: 'Error',               className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  inactivo:                 { label: 'Inactivo',            className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border', config.className, className)}>
      {config.label}
    </span>
  )
}
