import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BellRing, CalendarCheck, Monitor, QrCode, ShieldCheck, Ticket, Wrench } from 'lucide-react'
import { getPublicPricing } from '@/server/actions/leads'
import { LegalLinks } from '@/components/legal/legal-links'
import { PricingPlans } from './pricing-plans'
import { DemoForm } from './demo-form'
import { fcfa } from '@/lib/billing-labels'

export const revalidate = 600
export const metadata: Metadata = {
  title: 'Tarifs et démonstration — Lerena',
  description: 'Gestion des files d’attente pour hôpitaux, administrations, banques et commerces : prix par site, essai gratuit, installation sur place.'
}

const BENEFITS = [
  { icon: Ticket, title: 'Ticket sans attente debout', text: 'Par QR code, sur la borne ou à l’accueil, avec ou sans smartphone.' },
  { icon: BellRing, title: 'Alerte quand le tour approche', text: 'Notification sur le téléphone ou SMS : le visiteur peut s’éloigner.' },
  { icon: Monitor, title: 'Écran d’appel et annonce vocale', text: 'Sur une TV existante ; vos messages défilent entre les appels.' },
  { icon: CalendarCheck, title: 'Rendez-vous et rappels', text: 'Créneaux en ligne, code d’arrivée, rappels la veille et 2 h avant.' },
  { icon: QrCode, title: 'Prêt en moins d’une heure', text: 'Assistant de démarrage, appareils installés par simple QR code.' },
  { icon: ShieldCheck, title: 'Données protégées', text: 'Conforme à la loi ivoirienne 2013-450, hébergement sécurisé.' }
]

/** Page publique des établissements : bénéfices, forfaits par site, boutique et demande de démonstration. */
export default async function PricingPage() {
  const data = await getPublicPricing()
  const hardware = data.products.filter(p => p.kind === 'HARDWARE' || p.kind === 'SETUP')

  return (
    <main className="min-h-screen bg-surface-sunken">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-700 px-5 pb-20 pt-8 text-white">
        <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 hover:text-white"><ArrowLeft size={15} /> Lerena</Link>
            <Link href="/pro/login" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/25">Espace pro</Link>
          </div>
          <div className="mt-10 max-w-2xl animate-rise-in">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Pour les établissements</p>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Fini les salles d’attente bondées.</h1>
            <p className="mt-4 text-lg text-white/85">Hôpitaux, mairies, banques, agences : vos visiteurs prennent un ticket et attendent où ils veulent. Vous suivez tout en direct.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#demo" className="pressable rounded-2xl bg-white px-6 py-3.5 font-bold text-brand-700 shadow-raised">Demander une démo</a>
              <a href="#forfaits" className="rounded-2xl bg-white/15 px-6 py-3.5 font-bold backdrop-blur hover:bg-white/25">Voir les tarifs</a>
            </div>
            {data.trialDays > 0 && <p className="mt-3 text-sm text-white/75">{data.trialDays} jours d’essai gratuit, sans engagement.</p>}
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-10 max-w-5xl space-y-14 px-5 pb-12">
        <section className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(b => (
            <div key={b.title} className="lift rounded-card bg-white p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><b.icon size={20} /></span>
              <p className="mt-3 font-semibold text-ink">{b.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{b.text}</p>
            </div>
          ))}
        </section>

        <section id="forfaits" className="scroll-mt-6">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Un prix par site, tout compris</h2>
          <p className="mt-1 text-sm text-ink-muted">Prix hors taxes par site et par mois. Mises à jour, hébergement et assistance inclus.</p>
          <PricingPlans plans={data.plans} />
        </section>

        {hardware.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Wrench size={20} className="text-brand" /> Matériel et installation</h2>
            <p className="mt-1 text-sm text-ink-muted">Vous pouvez utiliser votre propre matériel, ou nous le confier : vente ou location, installé et configuré sur place.</p>
            <ul className="stagger mt-4 grid gap-2 sm:grid-cols-2">
              {hardware.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
                  <span className="min-w-0"><span className="block font-medium text-ink">{p.name}</span>{p.description && <span className="block truncate text-xs text-ink-subtle">{p.description}</span>}</span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-ink">{fcfa(p.price)}{p.rentalMonthly != null && <span className="block text-xs font-normal text-ink-muted">ou {fcfa(p.rentalMonthly)}/mois</span>}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="demo" className="scroll-mt-6 grid gap-8 rounded-card bg-white p-6 shadow-card sm:p-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Demander une démonstration</h2>
            <p className="mt-2 text-sm text-ink-muted">Nous vous rappelons sous 24 heures ouvrées pour une démonstration sur place ou en visio, et un devis adapté à vos sites.</p>
            <ul className="mt-5 space-y-2 text-sm text-ink">
              <li>✓ Installation et formation de vos agents sur place</li>
              <li>✓ Essai gratuit avant tout engagement</li>
              <li>✓ Paiement par Mobile Money ou virement</li>
            </ul>
          </div>
          <DemoForm />
        </section>
      </div>
      <LegalLinks pro className="pb-8" />
    </main>
  )
}
