'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, LogIn } from 'lucide-react'
import { checkInAppointment, getTodayAppointments } from '@/server/actions/appointments'
import { Badge, Button, useToast } from '@/components/ui'
import { usePolling } from '@/hooks/use-polling'

type Row = Awaited<ReturnType<typeof getTodayAppointments>>[number]
const STATE = { EXPECTED: ['Attendu', 'neutral'], LATE: ['En retard', 'warning'], ARRIVED: ['Arrivé', 'success'], NO_SHOW: ['Absent', 'danger'] } as const

/**
 * Rendez-vous du jour à l'accueil : signaler l'arrivée d'un visiteur (liste ou code à 6 chiffres).
 * L'arrivée crée un ticket placé à l'heure du rendez-vous.
 */
export function TodayAppointments({ onIssued }: { onIssued?: (displayNum: string) => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => getTodayAppointments().then(setRows), [])
  useEffect(() => { load() }, [load])
  usePolling(load, 30_000)

  const arrive = async (input: { id?: string; code?: string }) => {
    setBusy(input.id ?? 'code')
    const res = await checkInAppointment(input)
    setBusy(null)
    if (!res.success) return toast(res.error, 'error')
    toast(res.already ? `Déjà arrivé : ticket ${res.displayNum}` : `Arrivée enregistrée : ticket ${res.displayNum}`)
    onIssued?.(res.displayNum)
    setCode('')
    load()
  }

  if (!rows) return null

  return (
    <section className="rounded-card border border-surface-line bg-white shadow-card">
      <p className="flex items-center gap-2 border-b border-surface-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        <CalendarCheck size={15} aria-hidden="true" /> Rendez-vous du jour · {rows.length}
      </p>
      <form onSubmit={e => { e.preventDefault(); if (code.length === 6) arrive({ code }) }} className="flex gap-2 border-b border-surface-line p-3">
        <label className="sr-only" htmlFor="rdv-code">Code d’arrivée</label>
        <input id="rdv-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Code à 6 chiffres"
          className="min-w-0 flex-1 rounded-control border border-gray-200 px-3 font-mono tracking-widest text-ink" />
        <Button type="submit" size="sm" loading={busy === 'code'} disabled={code.length !== 6}>Arrivé</Button>
      </form>
      {rows.length === 0 ? (
        <p className="p-4 text-center text-sm text-ink-subtle">Aucun rendez-vous aujourd’hui.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-surface-line overflow-y-auto">
          {rows.map(r => {
            const [label, tone] = STATE[r.state]
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate"><span className="font-mono font-bold text-ink">{r.time}</span> <span className="text-ink">{r.name}</span></p>
                  <p className="truncate text-xs text-ink-subtle">{r.service}</p>
                </div>
                {r.state === 'EXPECTED' || r.state === 'LATE' ? (
                  <Button size="sm" variant="secondary" icon={<LogIn size={14} />} loading={busy === r.id} onClick={() => arrive({ id: r.id })}>Arrivé</Button>
                ) : (
                  <Badge tone={tone}>{label}</Badge>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
