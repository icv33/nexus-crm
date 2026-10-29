'use client'

import { useEffect } from 'react'

export function CerebroAutoRun() {
  useEffect(() => {
    async function run() {
      try {
        const statusRes = await fetch('/api/cerebro/run')
        const status = await statusRes.json()
        if (!status.habilitado) return
        await fetch('/api/cerebro/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: false }) })
      } catch {}
    }

    run()
    const interval = setInterval(run, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return null
}
