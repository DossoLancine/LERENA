'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Bell, CalendarCheck, Check, Clock, MapPin, Plus, QrCode, Search, Share2, SlidersHorizontal, Sparkles, Star, Ticket, Users, Zap
} from 'lucide-react'
import { getOrganizations } from '@/server/actions/orgs'
import type { getActiveTicketSummary } from '@/server/actions/tickets'
import { DynamicIcon } from '@/lib/icons'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'
import { AnimatedNumber } from '@/components/ui'

type Org = Awaited<ReturnType<typeof getOrganizations>>[number]
type ActiveTicket = NonNullable<Awaited<ReturnType<typeof getActiveTicketSummary>>>
type Sector = { slug: string; name: string; icon: string }

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Bonsoir' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

/** Visuel d'un établissement : son logo, sinon l'icône de son secteur sur un dégradé de sa couleur. */
function OrgVisual({ org, className, iconSize = 40 }: { org: Org; className?: string; iconSize?: number }) {
  const hex = org.brandColor ?? org.colorHex ?? '#c2410c'
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)} style={{ background: `linear-gradient(140deg, ${hex}1f 0%, ${hex}47 100%)` }}>
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/40" aria-hidden="true" />
      {org.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={org.logoUrl} alt="" loading="lazy" className="relative h-3/5 w-3/5 rounded-2xl bg-white object-contain p-1.5 shadow-sm" />
        : <span className="relative" style={{ color: hex }}><DynamicIcon name={org.icon} size={iconSize} /></span>}
    </div>
  )
}

function Rating({ org }: { org: Org }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur">
      <Star size={11} className="fill-amber-400 text-amber-400" />
      {org.rating > 0 ? <>{org.rating.toLocaleString('fr-FR')} <span className="font-normal text-ink-subtle">({org.reviewCount})</span></> : 'Nouveau'}
    </span>
  )
}

const share = async (org: Org) => {
  const url = `${window.location.origin}/org/${org.id}`
  try {
    if (navigator.share) await navigator.share({ title: org.name, text: `File d’attente — ${org.name}`, url })
    else await navigator.clipboard.writeText(url)
  } catch { /* partage annulé */ }
}

interface Slide { key: string; badge: string; title: string; text: string; cta: string; href: string; visual: React.ReactNode }

/** Carrousel d'accueil : défile seul, s'arrête au toucher, points indicateurs comme sur une app native. */
function HeroCarousel({ slides }: { slides: Slide[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const pausedUntil = useRef(0)

  const goTo = useCallback((i: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current || document.hidden) return
      goTo((index + 1) % slides.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [index, slides.length, goTo])

  return (
    <div>
      <div ref={ref} onPointerDown={() => { pausedUntil.current = Date.now() + 10_000 }}
        onScroll={e => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / el.clientWidth)) }}
        className="hide-scrollbar -mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-5" aria-roledescription="carrousel">
        {slides.map((s, i) => (
          <div key={s.key} className="w-full shrink-0 snap-center pr-0" style={{ paddingRight: i < slides.length - 1 ? 0 : undefined }} aria-roledescription="diapositive" aria-label={`${i + 1} sur ${slides.length}`}>
            <div className="relative mr-3 h-[208px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#fb923c] via-brand to-brand-700 p-5 text-white shadow-[0_18px_40px_-18px_rgba(194,65,12,0.65)]">
              {/* Courbes décoratives */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
                <path d="M-20 150 C 80 60, 160 220, 260 110 S 420 40, 440 90" fill="none" stroke="white" strokeWidth="2" />
                <path d="M-20 175 C 90 95, 170 240, 270 140 S 420 80, 440 120" fill="none" stroke="white" strokeWidth="1" />
              </svg>
              <div className="relative z-10 flex h-full max-w-[60%] flex-col">
                <span className="w-fit rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand-700 shadow-sm">{s.badge}</span>
                <p className="mt-2.5 line-clamp-2 text-[22px] font-black leading-[1.1] tracking-tight">{s.title}</p>
                <p className="mb-3 mt-1 line-clamp-2 text-xs text-white/85">{s.text}</p>
                <Link href={s.href} onClick={() => haptics.tap()} className="pressable mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-md">
                  {s.cta} <ArrowRight size={15} />
                </Link>
              </div>
              <div className="absolute bottom-0 right-0 top-0 flex w-[44%] items-center justify-center">{s.visual}</div>
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Diapositives">
          {slides.map((s, i) => (
            <button key={s.key} type="button" role="tab" aria-selected={i === index} aria-label={`Diapositive ${i + 1}`} onClick={() => { pausedUntil.current = Date.now() + 10_000; goTo(i) }}
              className={cn('h-1.5 rounded-full transition-all duration-500 ease-spring', i === index ? 'w-7 bg-brand' : 'w-1.5 bg-brand/25')} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Accueil de l'application (visiteur connecté ou non) : recherche, secteurs, carrousel d'actions,
 * établissements à l'attente la plus courte et à proximité, avec leur attente en direct.
 */
export function HomeScreen({ firstName, activeTicket, initialOrgs, sectors }: {
  firstName: string | null
  activeTicket: ActiveTicket | null
  initialOrgs: Org[]
  sectors: Sector[]
}) {
  const router = useRouter()
  const [orgs, setOrgs] = useState(initialOrgs)
  const [query, setQuery] = useState('')
  const [hello, setHello] = useState('Bonjour')

  useEffect(() => {
    setHello(greeting())
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async p => setOrgs(await getOrganizations(undefined, p.coords.latitude, p.coords.longitude)),
      () => {}, // position refusée : liste sans distances
      { maximumAge: 5 * 60_000, timeout: 8000 }
    )
  }, [])

  const open = useMemo(() => orgs.filter(o => o.isOpen), [orgs])
  const quickest = useMemo(() => [...open].sort((a, b) => Number(b.featured) - Number(a.featured) || a.waitMin - b.waitMin).slice(0, 8), [open])
  const nearby = useMemo(() => (orgs.some(o => o.distance) ? [...open].sort((a, b) => a.distanceNum - b.distanceNum) : open).slice(0, 6), [orgs, open])
  const waitingNow = useMemo(() => orgs.reduce((s, o) => s + (o.waitingCount || 0), 0), [orgs])
  const spotlight = open.find(o => o.featured) ?? quickest[0]

  const slides: Slide[] = [
    ...(activeTicket ? [{
      key: 'ticket', badge: activeTicket.status === 'CALLED' ? 'C’est votre tour !' : 'Votre ticket',
      title: activeTicket.status === 'WAITING' ? (activeTicket.ahead === 0 ? 'Vous êtes le prochain' : `${activeTicket.ahead} personne${activeTicket.ahead > 1 ? 's' : ''} avant vous`) : activeTicket.status === 'CALLED' ? `Allez au ${activeTicket.counterName || 'guichet'}` : 'Ticket en cours',
      text: `${activeTicket.orgName} · ${activeTicket.serviceName}${activeTicket.status === 'WAITING' && activeTicket.waitMin ? ` · ~${activeTicket.waitMin} min` : ''}`,
      cta: 'Suivre', href: `/ticket/${activeTicket.id}`,
      visual: (
        <div className="relative rotate-6 rounded-2xl bg-white px-4 py-3 text-center text-brand-700 shadow-xl animate-pop-in">
          <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-brand" aria-hidden="true" />
          <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-brand-600" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle">N°</p>
          <p className="text-3xl font-black tabular-nums">{activeTicket.displayNum}</p>
        </div>
      )
    }] : []),
    {
      key: 'scan', badge: 'Le plus rapide', title: 'Un ticket en 10 secondes', text: 'Scannez le QR code à l’entrée, sans compte ni file debout.',
      cta: 'Scanner', href: '/scan',
      visual: (
        <div className="relative">
          <div className="flex h-28 w-20 -rotate-6 items-center justify-center rounded-[18px] border-4 border-white/90 bg-white/15 shadow-xl backdrop-blur"><QrCode size={40} /></div>
          <span className="absolute -right-6 top-3 rotate-6 rounded-xl bg-white px-2 py-1 text-xs font-black text-brand-700 shadow-lg animate-pop-in">A012</span>
          <span className="absolute -bottom-2 -left-5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand shadow-lg"><Bell size={17} /></span>
        </div>
      )
    },
    ...(spotlight ? [{
      key: 'spot', badge: spotlight.featured ? 'À la une' : 'Moins d’attente', title: spotlight.name,
      text: `${spotlight.waitMin ? `~${spotlight.waitMin} min d’attente` : 'Pas d’attente'} · ${spotlight.waitingCount} en file${spotlight.distance ? ` · ${spotlight.distance}` : ''}`,
      cta: 'Prendre un ticket', href: `/org/${spotlight.id}`,
      visual: <OrgVisual org={spotlight} className="h-28 w-28 rotate-3 rounded-[28px] bg-white shadow-xl" iconSize={48} />
    }] : []),
    {
      key: 'rdv', badge: 'Nouveau', title: 'Réservez votre passage', text: 'Choisissez un créneau, recevez un rappel, passez à l’heure.',
      cta: 'Explorer', href: '/explore',
      visual: (
        <div className="relative">
          <div className="flex h-24 w-24 -rotate-3 flex-col overflow-hidden rounded-2xl bg-white text-brand-700 shadow-xl">
            <span className="bg-brand-600 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white">Rendez-vous</span>
            <span className="flex flex-1 items-center justify-center"><CalendarCheck size={38} /></span>
          </div>
          <span className="absolute -right-4 -top-3 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-success-ink shadow-lg">10:30 ✓</span>
        </div>
      )
    }
  ]

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : '/explore')
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-28">
      {/* En-tête chaleureux */}
      <div className="bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] via-60% to-surface-sunken">
        <div className="mx-auto max-w-xl px-5 pb-2 pt-7">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-2xl font-black tracking-tight text-ink">
              Lerena <Zap size={20} className="fill-brand text-brand" aria-hidden="true" />
            </span>
            {firstName ? (
              <Link href={activeTicket ? `/ticket/${activeTicket.id}` : '/tickets'} aria-label={activeTicket ? 'Mon ticket en cours' : 'Mes tickets'}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-black/5">
                <Bell size={20} />
                {activeTicket && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white animate-pulse" />}
              </Link>
            ) : (
              <Link href="/auth/login" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm ring-1 ring-black/5">Se connecter</Link>
            )}
          </div>

          <p className="mt-4 text-sm text-ink-muted">{hello}{firstName ? `, ${firstName}` : ''} 👋</p>
          <h1 className="text-[26px] font-black leading-tight tracking-tight text-ink">Où voulez-vous éviter la file aujourd’hui ?</h1>
          {waitingNow > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
              <AnimatedNumber value={waitingNow} /> {waitingNow > 1 ? 'personnes attendent' : 'personne attend'} en ce moment sans faire la queue
            </p>
          )}

          {/* Recherche */}
          <form onSubmit={search} className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 shadow-[0_10px_30px_-12px_rgba(194,65,12,0.35)] ring-1 ring-black/5">
            <Search size={19} className="shrink-0 text-ink-subtle" aria-hidden="true" />
            <label className="sr-only" htmlFor="home-search">Rechercher un établissement</label>
            <input id="home-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Hôpital, mairie, banque…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-subtle" />
            <Link href="/explore" aria-label="Filtres et carte" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#fb923c] to-brand text-white shadow-md">
              <SlidersHorizontal size={18} />
            </Link>
          </form>

          {/* Secteurs */}
          <div className="hide-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
            <Link href="/explore" className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-[#fb923c] to-brand px-4 py-2 text-sm font-semibold text-white shadow-md">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-brand"><Check size={11} strokeWidth={3.5} /></span> Tous
            </Link>
            {sectors.map(s => (
              <Link key={s.slug} href={`/explore?cat=${s.slug}`} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-muted shadow-sm ring-1 ring-black/5 hover:text-ink">
                <DynamicIcon name={s.icon} size={15} /> {s.name}
              </Link>
            ))}
          </div>
          <div className="pt-4"><HeroCarousel slides={slides} /></div>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-8 px-5 pt-6">

        {/* Attente la plus courte : cartes horizontales */}
        {quickest.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Attente la plus courte</h2>
              <Link href="/explore" className="text-sm font-semibold text-brand">Voir tout</Link>
            </div>
            <div className="hide-scrollbar stagger -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {quickest.map(org => (
                <Link key={org.id} href={`/org/${org.id}`} className="lift w-[168px] shrink-0 rounded-[24px] bg-white p-2 shadow-card ring-1 ring-black/[0.03]">
                  <div className="relative">
                    <OrgVisual org={org} className="h-[124px] rounded-[18px]" />
                    <span className="absolute bottom-2 left-2"><Rating org={org} /></span>
                    {org.featured && <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"><Sparkles size={10} /> À la une</span>}
                  </div>
                  <div className="px-1.5 pb-1 pt-2.5">
                    <p className="truncate font-semibold text-brand-700">{org.name}</p>
                    <p className="truncate text-xs text-ink-subtle">{org.category}{org.distance ? ` · ${org.distance}` : ''}</p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-ink"><Clock size={12} className="text-brand" />{org.waitMin ? `~${org.waitMin} min` : 'Sans attente'}</span>
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] text-ink-subtle"><Users size={11} />{org.waitingCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Près de vous : liste détaillée avec action directe */}
        {nearby.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">{orgs.some(o => o.distance) ? 'Près de vous' : 'Ouverts maintenant'}</h2>
              <Link href="/explore" className="text-sm font-semibold text-brand">Carte</Link>
            </div>
            <ul className="stagger space-y-3">
              {nearby.map(org => (
                <li key={org.id} className="lift relative flex gap-3 rounded-[24px] bg-white p-2.5 shadow-card ring-1 ring-black/[0.03]">
                  <Link href={`/org/${org.id}`} className="relative shrink-0" aria-label={org.name}>
                    <OrgVisual org={org} className="h-[96px] w-[96px] rounded-[18px]" iconSize={34} />
                    <span className="absolute bottom-1.5 left-1.5"><Rating org={org} /></span>
                  </Link>
                  <div className="min-w-0 flex-1 py-0.5 pr-8">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-ink-subtle"><DynamicIcon name={org.icon} size={12} /> {org.category}</p>
                    <Link href={`/org/${org.id}`} className="block truncate text-base font-bold text-ink">{org.name}</Link>
                    <p className="flex items-center gap-1 truncate text-xs text-ink-subtle"><Users size={11} /> {org.waitingCount} en file{org.distance && <><span aria-hidden="true">·</span><MapPin size={11} />{org.distance}</>}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-lg bg-gradient-to-br from-[#fb923c] to-brand px-2.5 py-1 text-xs font-bold text-white shadow-sm">{org.waitMin ? `~${org.waitMin} min` : 'Sans attente'}</span>
                      <Link href={`/org/${org.id}`} aria-label={`Prendre un ticket chez ${org.name}`} className="pressable flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand ring-1 ring-brand/20"><Plus size={16} strokeWidth={2.5} /></Link>
                    </div>
                  </div>
                  <button type="button" onClick={() => share(org)} aria-label={`Partager ${org.name}`} className="absolute right-3 top-3 rounded-full p-1.5 text-ink-subtle hover:bg-gray-100 hover:text-ink"><Share2 size={15} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sans compte : comment ça marche et accès pro */}
        {!firstName && (
          <section className="grid grid-cols-3 gap-2">
            {[[QrCode, 'Scannez', 'le QR code à l’entrée'], [Ticket, 'Recevez', 'votre numéro'], [Bell, 'Soyez prévenu', 'quand c’est bientôt']].map(([Icon, title, text]) => {
              const I = Icon as typeof QrCode
              return (
                <div key={title as string} className="rounded-2xl bg-white p-3 text-center shadow-card">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><I size={19} /></span>
                  <p className="mt-2 text-sm font-semibold text-ink">{title as string}</p>
                  <p className="text-[11px] leading-tight text-ink-subtle">{text as string}</p>
                </div>
              )
            })}
          </section>
        )}

        <Link href="/tarifs" className="lift flex items-center gap-3 rounded-[24px] bg-ink p-4 text-white shadow-card">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Sparkles size={20} className="text-amber-300" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Vous gérez un établissement ?</span>
            <span className="block text-xs text-white/70">Lerena pour les pros : essai gratuit, installation sur place</span>
          </span>
          <ArrowRight size={18} className="shrink-0" />
        </Link>
      </div>
    </div>
  )
}
