import Link from 'next/link'
import { redirect } from 'next/navigation'
import { QrCode, Search, Ticket, BellRing, MapPin, Clock, Users, ChevronRight, Building2 } from 'lucide-react'
import { getSessionUser } from '@/lib/session'
import { getOrganizations } from '@/server/actions/orgs'
import { t } from '@/lib/i18n'
import { homeForRole } from '@/lib/constants'
import { LegalLinks } from '@/components/legal/legal-links'

// Accueil public : comprendre Lerena en quelques secondes et prendre un ticket sans compte
export default async function LandingPage() {
  const user = await getSessionUser()
  if (user) redirect(homeForRole(user.role))

  const orgs = (await getOrganizations()).filter(o => o.isOpen).slice(0, 4)

  const steps = [
    { icon: <Search size={20} />, title: t('landing.step1Title'), text: t('landing.step1Text') },
    { icon: <Ticket size={20} />, title: t('landing.step2Title'), text: t('landing.step2Text') },
    { icon: <BellRing size={20} />, title: t('landing.step3Title'), text: t('landing.step3Text') },
  ]

  return (
    <main className="min-h-screen bg-surface-sunken">
      {/* En-tête */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand to-brand-600 px-5 pb-16 pt-10 text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-lg">
          <div className="mb-8 flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand"><Ticket size={20} /></span>
              Lerena
            </span>
            <Link href="/auth/login" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/25">
              {t('landing.login')}
            </Link>
          </div>

          <h1 className="text-4xl font-black leading-tight tracking-tight">{t('landing.title')}</h1>
          <p className="mt-3 text-lg text-white/85">{t('landing.subtitle')}</p>

          <div className="mt-8 grid gap-3">
            <Link href="/scan" className="pressable flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-white py-4 text-base font-bold text-brand-600 shadow-raised">
              <QrCode size={20} /> {t('landing.scan')}
            </Link>
            <Link href="/explore" className="pressable flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-white/15 py-4 text-base font-bold backdrop-blur hover:bg-white/25">
              <Search size={20} /> {t('landing.find')}
            </Link>
          </div>
          <p className="mt-3 text-center text-sm text-white/75">{t('landing.noAccount')}</p>
        </div>
      </section>

      <div className="mx-auto -mt-8 max-w-lg space-y-6 px-5 pb-12">
        {/* Établissements ouverts avec leur attente en direct */}
        {orgs.length > 0 && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">{t('landing.openNow')}</h2>
            <ul className="divide-y divide-surface-line">
              {orgs.map(org => (
                <li key={org.id}>
                  <Link href={`/org/${org.id}`} className="flex items-center gap-3 py-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Building2 size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{org.name}</span>
                      <span className="mt-0.5 flex items-center gap-3 text-xs text-ink-muted">
                        <span className="flex items-center gap-1"><Clock size={11} />{t('common.minutes', { count: org.waitMin })}</span>
                        <span className="flex items-center gap-1"><Users size={11} />{org.waitingCount}</span>
                        <span className="flex items-center gap-1 truncate"><MapPin size={11} />{org.address}</span>
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comment ça marche */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">{t('landing.howTitle')}</h2>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex items-start gap-4 rounded-card bg-white p-4 shadow-card">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">{step.icon}</span>
                <div>
                  <p className="font-semibold text-ink">{i + 1}. {step.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-card border border-surface-line bg-white p-5 text-center">
          <p className="font-semibold text-ink">{t('landing.proTitle')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('landing.proText')}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link href="/tarifs" className="pressable inline-flex items-center gap-1 rounded-control bg-brand px-4 py-2.5 text-sm font-bold text-white">Tarifs et démo <ChevronRight size={16} /></Link>
            <Link href="/pro/login" className="inline-flex items-center gap-1 text-sm font-bold text-brand">
              {t('landing.proCta')} <ChevronRight size={16} />
            </Link>
          </div>
        </section>
      </div>
      <LegalLinks className="pb-8 pt-2" />
    </main>
  )
}
