'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, FlaskConical, CalendarPlus, FilePlus2, KeyRound, LogOut, MessageSquarePlus, Play, Receipt, ShieldOff, Sparkles, Trash2, XCircle } from 'lucide-react'
import {
  addPayment, adjustSmsCredits, cancelSubscription, createCustomInvoice, extendTrial, invoiceSubscription, setFeatured,
  setSuspended, supportUserAction, updateSubscription, type getClient
} from '@/server/actions/billing-admin'
import { Badge, Button, Card, CardHeader, Dialog, SelectInput, TextArea, TextInput, useToast } from '@/components/ui'
import { InvoiceBadge, StateBadge, UsageMeter } from '@/components/billing/badges'
import { PAYMENT_METHODS, fcfa } from '@/lib/billing-labels'

type Data = NonNullable<Awaited<ReturnType<typeof getClient>>>
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')
const ROLE: Record<string, string> = { MANAGER: 'Responsable', AGENT: 'Agent', RECEPTION: 'Accueil' }

/** Fiche client de la console Lerena. */
export function ClientFile({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const { org, sub, state } = data
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'trial' | 'featured' | 'sms' | 'invoice' | 'pay' | 'cancel'>(null)
  const [payFor, setPayFor] = useState<Data['invoices'][number] | null>(null)
  const [lines, setLines] = useState([{ label: '', qty: '1', unitPrice: '' }])

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (!res.success) return toast(res.error ?? 'Opération impossible', 'error')
    toast(ok)
    setDialog(null)
    router.refresh()
  }

  const saveSub = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    run('sub', () => updateSubscription(org.id, {
      planId: String(f.get('planId')), billingCycle: String(f.get('billingCycle')),
      customPricePerSite: String(f.get('customPricePerSite') ?? ''), discountPct: String(f.get('discountPct') ?? '0'), notes: String(f.get('notes') ?? '')
    }), 'Abonnement enregistré')
  }

  const suspended = state.state === 'SUSPENDED'
  const featured = org.featuredUntil && new Date(org.featuredUntil) > new Date()

  return (
    <div className="space-y-4">
      <Link href="/admin/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeft size={15} /> Clients</Link>

      {/* En-tête */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-brand-50 via-white to-white p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{org.name}</h1>
              <StateBadge state={state.state} daysLeft={state.daysLeft} />
              {featured && <Badge tone="warning"><Sparkles size={12} /> À la une jusqu’au {date(org.featuredUntil)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{[org.category, org.city, org.network && `réseau ${org.network}`].filter(Boolean).join(' · ')} · client depuis le {date(org.createdAt)}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{[org.email, org.phone].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-ink-muted">Revenu mensuel</p>
            <p className="text-2xl font-bold tabular-nums text-ink">{fcfa(state.state === 'TRIAL' ? 0 : data.mrr)}</p>
            <p className="text-xs text-ink-subtle">{sub.plan.name} · {data.sites} site{data.sites > 1 ? 's' : ''}{state.state === 'TRIAL' ? ` · ${fcfa(data.mrr)} après l’essai` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-surface-line px-5 py-3">
          <Button size="sm" icon={<Receipt size={15} />} loading={busy === 'inv'} onClick={() => run('inv', () => invoiceSubscription(org.id), 'Facture d’abonnement créée et envoyée')}>Facturer l’abonnement</Button>
          <Button size="sm" variant="secondary" icon={<FilePlus2 size={15} />} onClick={() => setDialog('invoice')}>Facture libre</Button>
          <Button size="sm" variant="secondary" icon={<CalendarPlus size={15} />} onClick={() => setDialog('trial')}>Prolonger l’essai</Button>
          <Button size="sm" variant="secondary" icon={<Sparkles size={15} />} onClick={() => setDialog('featured')}>Mise en avant</Button>
          <Button size="sm" variant="secondary" icon={<MessageSquarePlus size={15} />} onClick={() => setDialog('sms')}>Crédits SMS</Button>
          <Link href={`/admin/clients/${org.id}/pilot`} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-gray-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-gray-50"><FlaskConical size={15} /> Pilote</Link>
          <span className="flex-1" />
          {suspended && sub.status !== 'SUSPENDED'
            ? <span className="self-center text-xs font-medium text-danger">Suspendu faute de paiement : encaissez la facture ou prolongez l’essai</span>
            : suspended
            ? <Button size="sm" variant="secondary" icon={<Play size={15} />} loading={busy === 'susp'} onClick={() => run('susp', () => setSuspended(org.id, false), 'Client réactivé')}>Réactiver</Button>
            : <Button size="sm" variant="ghost" icon={<Ban size={15} />} className="text-danger" loading={busy === 'susp'} onClick={() => confirm(`Suspendre ${org.name} ? Les tickets en ligne s’arrêtent, les données restent.`) && run('susp', () => setSuspended(org.id, true), 'Client suspendu')}>Suspendre</Button>}
          {state.state !== 'CANCELLED' && <Button size="sm" variant="ghost" icon={<XCircle size={15} />} className="text-danger" onClick={() => setDialog('cancel')}>Résilier</Button>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Abonnement */}
        <Card className="lg:col-span-2">
          <CardHeader title="Abonnement" subtitle={state.state === 'TRIAL' ? `Essai jusqu’au ${date(sub.trialEndsAt)}` : sub.currentPeriodEnd ? `Payé jusqu’au ${date(sub.currentPeriodEnd)}` : 'Sans échéance (contrat sur mesure)'} />
          <form onSubmit={saveSub} className="grid gap-4 p-5 sm:grid-cols-2">
            <SelectInput name="planId" label="Forfait" defaultValue={sub.planId}>
              {data.plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.priceMonthly == null ? 'sur devis' : `${fcfa(p.priceMonthly)} / site / mois`}</option>)}
            </SelectInput>
            <SelectInput name="billingCycle" label="Facturation" defaultValue={sub.billingCycle}>
              <option value="MONTHLY">Mensuelle</option>
              <option value="YEARLY">Annuelle (−{sub.plan.yearlyDiscountPct} %)</option>
            </SelectInput>
            <TextInput name="customPricePerSite" label="Prix négocié par site (FCFA HT / mois)" type="number" min={0} defaultValue={sub.customPricePerSite ?? ''} hint="Vide = prix du forfait" />
            <TextInput name="discountPct" label="Remise commerciale (%)" type="number" min={0} max={100} defaultValue={sub.discountPct} />
            <div className="sm:col-span-2"><TextArea name="notes" label="Notes internes" rows={2} defaultValue={sub.notes ?? ''} placeholder="Contexte commercial, contact décideur, conditions particulières…" /></div>
            <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy === 'sub'}>Enregistrer</Button></div>
          </form>
        </Card>

        {/* Consommation */}
        <Card>
          <CardHeader title="Consommation" subtitle="Mois en cours" />
          <div className="space-y-4 p-5">
            <UsageMeter label="Tickets" used={data.ticketsMonth} max={sub.plan.maxTicketsMonth == null ? null : sub.plan.maxTicketsMonth * data.sites} />
            <UsageMeter label="SMS du forfait" used={data.sms.used} max={data.sms.included || null} />
            <div className="flex justify-between text-sm"><span className="text-ink-muted">SMS achetés restants</span><span className="font-semibold tabular-nums">{data.sms.credits.toLocaleString('fr-FR')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-muted">Appareils</span><span className="font-semibold tabular-nums">{org.devices}</span></div>
          </div>
          <ul className="divide-y divide-surface-line border-t border-surface-line">
            {data.branches.map(b => (
              <li key={b.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                <span className="truncate text-ink">{b.name}{!b.isActive && <span className="text-ink-subtle"> (fermé)</span>}</span>
                <span className="shrink-0 text-xs text-ink-muted">{b.counters}{sub.plan.maxCounters ? `/${sub.plan.maxCounters}` : ''} guichets · {b.services}{sub.plan.maxServices ? `/${sub.plan.maxServices}` : ''} services</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Factures */}
      <Card>
        <CardHeader title={`Factures (${data.invoices.length})`} />
        {data.invoices.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Aucune facture pour l’instant.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Numéro</th><th scope="col" className="px-3 py-2.5 font-semibold">Émise</th><th scope="col" className="px-3 py-2.5 font-semibold">Échéance</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">État</th><th scope="col" className="px-3 py-2.5 text-right font-semibold">Montant</th><th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-surface-line">
                {data.invoices.map(i => {
                  const overdue = i.status === 'SENT' && new Date(i.dueAt) < new Date()
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5"><Link href={`/admin/invoices/${i.id}`} className="font-mono font-semibold text-ink hover:text-brand">{i.number}</Link><span className="block text-xs text-ink-subtle">{i.kind === 'SUBSCRIPTION' ? 'Abonnement' : 'Commande'}</span></td>
                      <td className="px-3 py-2.5 text-ink-muted">{date(i.issuedAt)}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{date(i.dueAt)}</td>
                      <td className="px-3 py-2.5"><InvoiceBadge status={i.status} overdue={overdue} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fcfa(i.total)}{i.paid > 0 && i.status !== 'PAID' && <span className="block text-xs font-normal text-success-ink">{fcfa(i.paid)} reçus</span>}</td>
                      <td className="px-5 py-2.5 text-right">{i.status === 'SENT' && <Button size="sm" variant="secondary" onClick={() => { setPayFor(i); setDialog('pay') }}>Encaisser</Button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Équipe et support */}
        <Card>
          <CardHeader title={`Équipe (${data.members.length})`} subtitle="Actions de support tracées dans le journal" />
          <ul className="divide-y divide-surface-line">
            {data.members.map(m => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{m.name ?? '—'} <span className="font-normal text-ink-subtle">· {ROLE[m.orgRole] ?? m.orgRole}</span></span>
                  <span className="block truncate text-xs text-ink-subtle">{m.email ?? m.phone} · {m.lastLoginAt ? `vu le ${date(m.lastLoginAt)}` : 'jamais connecté'}{m.twoFactorEnabled ? ' · 2FA' : ''}</span>
                </span>
                <span className="flex gap-1">
                  <button type="button" title="Envoyer un lien de réinitialisation" aria-label={`Réinitialiser le mot de passe de ${m.name}`} onClick={() => run(`u${m.id}`, () => supportUserAction(m.id, 'RESET_LINK'), 'Lien de réinitialisation envoyé')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><KeyRound size={15} /></button>
                  <button type="button" title="Déconnecter de tous les appareils" aria-label={`Déconnecter ${m.name} partout`} onClick={() => run(`u${m.id}`, () => supportUserAction(m.id, 'SIGN_OUT'), 'Sessions fermées')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><LogOut size={15} /></button>
                  {m.twoFactorEnabled && <button type="button" title="Retirer la double authentification (téléphone perdu)" aria-label={`Retirer la double authentification de ${m.name}`} onClick={() => confirm('Retirer la double authentification de ce compte ?') && run(`u${m.id}`, () => supportUserAction(m.id, 'RESET_2FA'), 'Double authentification retirée')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><ShieldOff size={15} /></button>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Journal */}
        <Card>
          <CardHeader title="Journal" subtitle="Derniers événements de ce client" />
          {data.audit.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Rien pour l’instant.</p> : (
            <ul className="max-h-80 divide-y divide-surface-line overflow-y-auto">
              {data.audit.map(a => (
                <li key={a.id} className="px-5 py-2 text-sm">
                  <span className="font-mono text-xs font-semibold text-ink">{a.action}</span>
                  <span className="block text-xs text-ink-subtle">{new Date(a.createdAt).toLocaleString('fr-FR')}{a.details ? ` · ${a.details}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {data.smsLedger.length > 0 && (
            <div className="border-t border-surface-line px-5 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Mouvements SMS</p>
              <ul className="space-y-0.5 text-xs text-ink-muted">{data.smsLedger.map(l => <li key={l.id}><span className={l.delta > 0 ? 'font-semibold text-success-ink' : ''}>{l.delta > 0 ? '+' : ''}{l.delta}</span> · {l.reason} · {date(l.createdAt)}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      {/* Fenêtres */}
      <Dialog open={dialog === 'trial'} onClose={() => setDialog(null)} title="Prolonger l’essai">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const days = Number(new FormData(e.currentTarget).get('days')); run('trial', () => extendTrial(org.id, days), `Essai prolongé de ${days} jours`) }}>
          <TextInput name="days" label="Jours supplémentaires" type="number" min={1} max={365} defaultValue={15} required />
          <Button type="submit" fullWidth loading={busy === 'trial'}>Prolonger</Button>
        </form>
      </Dialog>

      <Dialog open={dialog === 'featured'} onClose={() => setDialog(null)} title="Mise en avant dans la recherche">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const days = Number(new FormData(e.currentTarget).get('days')); run('feat', () => setFeatured(org.id, days), days > 0 ? `À la une pendant ${days} jours` : 'Mise en avant retirée') }}>
          <p className="text-sm text-ink-muted">L’établissement apparaît en tête de la recherche avec le badge « À la une ». Normalement activée par le paiement d’une offre du catalogue ; ici, geste commercial ou correction.</p>
          <TextInput name="days" label="Durée (jours, 0 pour retirer)" type="number" min={0} max={365} defaultValue={featured ? 0 : 7} required />
          <Button type="submit" fullWidth loading={busy === 'feat'}>Appliquer</Button>
        </form>
      </Dialog>

      <Dialog open={dialog === 'sms'} onClose={() => setDialog(null)} title="Ajuster les crédits SMS">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); run('sms', () => adjustSmsCredits(org.id, Number(f.get('delta')), String(f.get('reason'))), 'Crédits SMS ajustés') }}>
          <p className="text-sm text-ink-muted">Solde actuel : <strong>{org.smsCredits}</strong> SMS. Utilisez un nombre négatif pour retirer.</p>
          <TextInput name="delta" label="Nombre de SMS" type="number" required defaultValue={100} />
          <TextInput name="reason" label="Motif" required maxLength={120} placeholder="Geste commercial, correction…" />
          <Button type="submit" fullWidth loading={busy === 'sms'}>Enregistrer</Button>
        </form>
      </Dialog>

      <Dialog open={dialog === 'invoice'} onClose={() => setDialog(null)} title="Facture libre" size="lg">
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); const notes = String(new FormData(e.currentTarget).get('notes') ?? ''); run('custom', () => createCustomInvoice(org.id, lines, notes), 'Facture créée et envoyée') }}>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_120px_36px] items-end gap-2">
              <TextInput label={i === 0 ? 'Désignation' : ' '} value={l.label} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} required />
              <TextInput label={i === 0 ? 'Qté' : ' '} type="number" min={1} value={l.qty} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
              <TextInput label={i === 0 ? 'Prix HT' : ' '} type="number" value={l.unitPrice} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x))} required />
              <button type="button" aria-label="Retirer la ligne" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="mb-1 rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger disabled:opacity-30"><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLines(ls => [...ls, { label: '', qty: '1', unitPrice: '' }])} className="text-sm font-semibold text-brand">+ Ajouter une ligne</button>
          <TextArea name="notes" label="Note sur la facture (facultatif)" rows={2} />
          <p className="text-right text-sm text-ink-muted">Total HT : <strong className="text-ink">{fcfa(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}</strong></p>
          <Button type="submit" fullWidth loading={busy === 'custom'}>Créer et envoyer</Button>
        </form>
      </Dialog>

      <Dialog open={dialog === 'pay'} onClose={() => setDialog(null)} title={`Encaisser ${payFor?.number ?? ''}`}>
        {payFor && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); run('pay', () => addPayment(payFor.id, { amount: String(f.get('amount')), method: String(f.get('method')), reference: String(f.get('reference') ?? '') }), 'Paiement enregistré') }}>
            <TextInput name="amount" label="Montant reçu (FCFA)" type="number" min={1} required defaultValue={payFor.total - payFor.paid} />
            <SelectInput name="method" label="Moyen de paiement" defaultValue="ORANGE_MONEY">
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectInput>
            <TextInput name="reference" label="Référence de la transaction" placeholder="Ex. ID Orange Money, n° de virement" />
            <p className="text-xs text-ink-muted">Une fois la facture soldée, ses effets s’appliquent seuls : période d’abonnement prolongée, SMS crédités, mise en avant activée.</p>
            <Button type="submit" fullWidth loading={busy === 'pay'}>Enregistrer le paiement</Button>
          </form>
        )}
      </Dialog>

      <Dialog open={dialog === 'cancel'} onClose={() => setDialog(null)} title="Résilier l’abonnement">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const reason = String(new FormData(e.currentTarget).get('reason') ?? ''); run('cancel', () => cancelSubscription(org.id, reason), 'Abonnement résilié') }}>
          <p className="text-sm text-ink-muted">Plus aucun ticket en ligne pour {org.name}. Les données restent consultables ; vous pourrez réactiver le client.</p>
          <TextArea name="reason" label="Motif" rows={2} required />
          <Button type="submit" variant="danger" fullWidth loading={busy === 'cancel'}>Résilier</Button>
        </form>
      </Dialog>
    </div>
  )
}
