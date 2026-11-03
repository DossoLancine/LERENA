// Rapport d'un établissement : chiffres par site figés pour la période, puis synthèse (chiffres clés, évolution,
// phrases « ce qui va bien / ce qui va mal », sites à surveiller) calculée pour les sites que le lecteur a le droit de voir.
// Sans accès à la base : utilisé par le serveur (envoi, page du rapport) et testé à part.

export interface SiteFigures {
  id: string
  name: string
  tickets: number
  served: number
  absent: number
  waitSum: number // minutes cumulées entre l'entrée en file et l'appel
  waitCount: number
  ratingSum: number
  ratingCount: number
  appointments: number
  noShows: number
  complaints: number
  peakHour: number | null
}

export interface ReportData {
  sites: SiteFigures[]
  previous: SiteFigures[]
  waitAlertMin: number
  /** Valeur en FCFA (tout l'établissement), si la valeur d'une visite est réglée. */
  money?: { lostAmount: number | null; noShows: number; atRisk: number; atRiskValue: number }
}

export const REPORT_KINDS = {
  DAILY: { label: 'Rapport du jour', period: 'la veille' },
  WEEKLY: { label: 'Rapport de la semaine', period: 'la semaine précédente' },
  MONTHLY: { label: 'Rapport du mois', period: 'le mois précédent' },
  SAMPLE: { label: 'Exemple de rapport', period: 'les 7 derniers jours' }
} as const
export type ReportKind = keyof typeof REPORT_KINDS

const sum = (rows: SiteFigures[], k: keyof SiteFigures) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
const round1 = (n: number) => Math.round(n * 10) / 10

export function totals(rows: SiteFigures[]) {
  const waitCount = sum(rows, 'waitCount')
  const ratingCount = sum(rows, 'ratingCount')
  const appointments = sum(rows, 'appointments')
  const tickets = sum(rows, 'tickets')
  return {
    visitors: tickets,
    served: sum(rows, 'served'),
    avgWait: waitCount ? Math.round(sum(rows, 'waitSum') / waitCount) : null,
    satisfaction: ratingCount ? round1(sum(rows, 'ratingSum') / ratingCount) : null,
    ratings: ratingCount,
    noShowRate: appointments ? Math.round((sum(rows, 'noShows') / appointments) * 100) : null,
    appointments,
    absentRate: tickets ? Math.round((sum(rows, 'absent') / tickets) * 100) : null,
    complaints: sum(rows, 'complaints')
  }
}

export type Totals = ReturnType<typeof totals>

export interface Line { tone: 'good' | 'bad' | 'neutral'; text: string }

const pctChange = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null)

/** Synthèse pour un ensemble de sites (le périmètre du lecteur). */
export function summarize(data: ReportData, siteIds: string[] | null) {
  const keep = (rows: SiteFigures[]) => (siteIds ? rows.filter(r => siteIds.includes(r.id)) : rows)
  const sites = keep(data.sites)
  const now = totals(sites)
  const before = totals(keep(data.previous))
  const lines: Line[] = []

  // Affluence
  const visitorsChange = pctChange(now.visitors, before.visitors)
  if (visitorsChange != null && Math.abs(visitorsChange) >= 15) {
    lines.push({ tone: 'neutral', text: `${now.visitors} visiteurs, ${visitorsChange > 0 ? `${visitorsChange} % de plus` : `${-visitorsChange} % de moins`} qu’à la période précédente.` })
  }
  // Attente
  if (now.avgWait != null && before.avgWait != null && before.avgWait > 0) {
    const diff = now.avgWait - before.avgWait
    if (diff <= -Math.max(2, before.avgWait * 0.1)) lines.push({ tone: 'good', text: `L’attente moyenne a baissé de ${-diff} min (${before.avgWait} → ${now.avgWait} min).` })
    else if (diff >= Math.max(2, before.avgWait * 0.1)) lines.push({ tone: 'bad', text: `L’attente moyenne a augmenté de ${diff} min (${before.avgWait} → ${now.avgWait} min).` })
  }
  if (now.avgWait != null && now.avgWait >= data.waitAlertMin) lines.push({ tone: 'bad', text: `Attente moyenne de ${now.avgWait} min, au-dessus de votre seuil de ${data.waitAlertMin} min.` })
  // Satisfaction
  if (now.satisfaction != null) {
    if (before.satisfaction != null && now.satisfaction - before.satisfaction >= 0.3) lines.push({ tone: 'good', text: `Satisfaction en hausse : ${String(before.satisfaction).replace('.', ',')} → ${String(now.satisfaction).replace('.', ',')}/5.` })
    else if (before.satisfaction != null && before.satisfaction - now.satisfaction >= 0.3) lines.push({ tone: 'bad', text: `Satisfaction en baisse : ${String(before.satisfaction).replace('.', ',')} → ${String(now.satisfaction).replace('.', ',')}/5.` })
    else if (now.satisfaction >= 4.3) lines.push({ tone: 'good', text: `Visiteurs très satisfaits : ${String(now.satisfaction).replace('.', ',')}/5 sur ${now.ratings} avis.` })
    if (now.satisfaction < 3.5) lines.push({ tone: 'bad', text: `Satisfaction basse : ${String(now.satisfaction).replace('.', ',')}/5.` })
  }
  // Absences et avis négatifs
  if (now.noShowRate != null && now.noShowRate >= 15) lines.push({ tone: 'bad', text: `${now.noShowRate} % des rendez-vous n’ont pas été honorés.` })
  else if (now.noShowRate != null && before.noShowRate != null && before.noShowRate - now.noShowRate >= 5) lines.push({ tone: 'good', text: `Moins de rendez-vous manqués : ${before.noShowRate} % → ${now.noShowRate} %.` })
  if (now.absentRate != null && now.absentRate >= 10) lines.push({ tone: 'bad', text: `${now.absentRate} % des visiteurs appelés étaient absents.` })
  if (now.complaints > 0) lines.push({ tone: 'bad', text: `${now.complaints} avis négatif${now.complaints > 1 ? 's' : ''} à suivre.` })
  const m = data.money
  if (m && !siteIds && (m.lostAmount || m.atRisk)) {
    const parts = [m.lostAmount ? `absences : ${m.lostAmount.toLocaleString('fr-FR')} FCFA perdus ce mois` : null, m.atRisk ? `${m.atRisk} client${m.atRisk > 1 ? 's' : ''} à risque (${m.atRiskValue.toLocaleString('fr-FR')} FCFA par an)` : null].filter(Boolean)
    lines.push({ tone: 'bad', text: `${parts.join(' · ').replace(/^./, c => c.toUpperCase())}.` })
  }
  if (!lines.some(l => l.tone !== 'neutral') && now.visitors > 0) lines.push({ tone: 'good', text: 'Rien d’anormal sur la période.' })

  // Sites à surveiller : attente au-dessus du seuil, satisfaction basse, avis négatifs répétés
  const watch = sites.map(s => {
    const t = totals([s])
    const reasons: string[] = []
    if (t.avgWait != null && t.avgWait >= data.waitAlertMin) reasons.push(`attente ${t.avgWait} min`)
    if (t.satisfaction != null && t.satisfaction < 3.5) reasons.push(`satisfaction ${String(t.satisfaction).replace('.', ',')}/5`)
    if (s.complaints >= 2) reasons.push(`${s.complaints} avis négatifs`)
    if (t.noShowRate != null && t.noShowRate >= 20) reasons.push(`${t.noShowRate} % d’absences aux RDV`)
    return { id: s.id, name: s.name, reasons, avgWait: t.avgWait, satisfaction: t.satisfaction, visitors: t.visitors }
  }).filter(w => w.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || (b.avgWait ?? 0) - (a.avgWait ?? 0))

  const busiest = [...sites].sort((a, b) => b.tickets - a.tickets)[0]
  const peak = busiest?.peakHour != null ? `${busiest.peakHour} h${sites.length > 1 ? ` (${busiest.name})` : ''}` : null

  return {
    now, before, lines, watch, peak,
    sites: sites.map(s => ({ id: s.id, name: s.name, ...totals([s]) })),
    delta: {
      visitors: visitorsChange,
      avgWait: now.avgWait != null && before.avgWait != null ? now.avgWait - before.avgWait : null,
      satisfaction: now.satisfaction != null && before.satisfaction != null ? round1(now.satisfaction - before.satisfaction) : null,
      noShowRate: now.noShowRate != null && before.noShowRate != null ? now.noShowRate - before.noShowRate : null
    }
  }
}

export type Summary = ReturnType<typeof summarize>

/** Résumé court (notification, e-mail en texte). */
export function headline(s: Summary) {
  const parts = [`${s.now.visitors} visiteurs`]
  if (s.now.avgWait != null) parts.push(`attente ${s.now.avgWait} min`)
  if (s.now.satisfaction != null) parts.push(`satisfaction ${String(s.now.satisfaction).replace('.', ',')}/5`)
  if (s.now.noShowRate != null) parts.push(`${s.now.noShowRate} % d’absences aux RDV`)
  return parts.join(' · ')
}
