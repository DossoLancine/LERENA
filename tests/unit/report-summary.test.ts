import { describe, expect, it } from 'vitest'
import { summarize, totals, type SiteFigures } from '@/lib/report-summary'

const site = (id: string, o: Partial<SiteFigures> = {}): SiteFigures => ({
  id, name: `Site ${id}`, tickets: 100, served: 90, absent: 5, waitSum: 2000, waitCount: 100, ratingSum: 400, ratingCount: 100,
  appointments: 20, noShows: 2, complaints: 0, peakHour: 9, ...o
})

describe('rapports', () => {
  it('chiffres clés pondérés par site', () => {
    const t = totals([site('a'), site('b', { tickets: 300, waitSum: 9000, waitCount: 300 })])
    expect(t.visitors).toBe(400)
    expect(t.avgWait).toBe(28) // (2000 + 9000) / 400
    expect(t.satisfaction).toBe(4)
    expect(t.noShowRate).toBe(10)
  })

  it('phrases : attente en baisse (bien), satisfaction en baisse (mal)', () => {
    const s = summarize({ sites: [site('a', { waitSum: 1500, ratingSum: 350 })], previous: [site('a', { waitSum: 2000, ratingSum: 400 })], waitAlertMin: 45 }, null)
    expect(s.lines.find(l => l.tone === 'good')?.text).toContain('baissé de 5 min (20 → 15 min)')
    expect(s.lines.find(l => l.tone === 'bad')?.text).toContain('Satisfaction en baisse')
  })

  it('le périmètre du lecteur ne montre que ses sites', () => {
    const data = { sites: [site('a'), site('b', { waitSum: 6000 })], previous: [], waitAlertMin: 45 }
    expect(summarize(data, ['a']).now.visitors).toBe(100)
    expect(summarize(data, null).watch.map(w => w.id)).toEqual(['b']) // attente 60 min au-dessus du seuil
    expect(summarize(data, ['a']).watch).toEqual([])
  })

  it('rien d’anormal quand tout est stable', () => {
    const s = summarize({ sites: [site('a')], previous: [site('a')], waitAlertMin: 45 }, null)
    expect(s.lines).toEqual([{ tone: 'good', text: 'Rien d’anormal sur la période.' }])
  })
})
