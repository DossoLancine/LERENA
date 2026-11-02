'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Compass, Heart, Plus, Star, Users } from 'lucide-react'
import { ListPageSkeleton } from '@/components/ui/skeletons'
import { DynamicIcon } from '@/lib/icons'
import { getMyFavorites, toggleFavorite } from '@/server/actions/favorites'
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/cn'

type Fav = Awaited<ReturnType<typeof getMyFavorites>>[number]

/** Favoris : attente en direct, tri par attente, prise de ticket en un geste. */
export default function FavoritesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [favorites, setFavorites] = useState<Fav[] | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login?callbackUrl=/favorites')
    if (status === 'authenticated') getMyFavorites().then(setFavorites)
  }, [status, router])

  const remove = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    haptics.tap()
    setFavorites(prev => prev?.filter(f => f.id !== id) ?? null) // retiré aussitôt, remis si le serveur refuse
    const res = await toggleFavorite(id)
    if (!res.success) getMyFavorites().then(setFavorites)
  }

  if (!favorites) return <ListPageSkeleton />
  // Les ouverts d'abord, du moins d'attente au plus d'attente
  const sorted = [...favorites].sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || a.waitMin - b.waitMin)

  return (
    <div className="min-h-screen bg-surface-sunken pb-28">
      <header className="bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] to-surface-sunken">
        <div className="mx-auto max-w-lg px-5 pb-3 pt-7">
          <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">Favoris</h1>
          <p className="text-sm text-ink-muted">{favorites.length ? 'Classés du moins d’attente au plus d’attente' : 'Vos établissements, à un geste'}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-2">
        {sorted.length === 0 ? (
          <section className="flex flex-col items-center rounded-[26px] bg-white px-6 py-10 text-center shadow-card ring-1 ring-black/[0.03]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand"><Heart size={30} /></span>
            <p className="mt-4 font-display text-xl font-bold text-ink">Aucun favori pour l’instant</p>
            <p className="mt-1 text-sm text-ink-muted">Touchez le cœur sur la fiche d’un établissement pour le retrouver ici, avec son attente en direct.</p>
            <Link href="/explore" className="pressable mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#fb923c] to-brand px-5 py-3 text-sm font-bold text-white shadow-md"><Compass size={17} /> Explorer</Link>
          </section>
        ) : (
          <ul className="stagger grid grid-cols-2 gap-3">
            {sorted.map(org => {
              const hex = org.brandColor ?? org.colorHex
              return (
                <li key={org.id}>
                  <Link href={`/org/${org.id}`} className="lift block rounded-[24px] bg-white p-2 shadow-card ring-1 ring-black/[0.03]">
                    <div className="relative flex h-[110px] items-center justify-center overflow-hidden rounded-[18px]" style={{ background: `linear-gradient(140deg, ${hex}1f, ${hex}47)` }}>
                      {org.logoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={org.logoUrl} alt="" loading="lazy" className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 shadow-sm" />
                        : <span style={{ color: hex }}><DynamicIcon name={org.icon} size={38} /></span>}
                      <button type="button" onClick={e => remove(e, org.id)} aria-label={`Retirer ${org.name} des favoris`} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm">
                        <Heart size={15} className="fill-red-500 text-red-500" />
                      </button>
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
                        <Star size={11} className="fill-amber-400 text-amber-400" />{org.rating > 0 ? org.rating.toLocaleString('fr-FR') : 'Nouveau'}
                      </span>
                    </div>
                    <div className="px-1.5 pb-1 pt-2.5">
                      <p className="truncate font-semibold text-ink">{org.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-subtle"><Users size={11} />{org.waitingCount} en file</p>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className={cn('rounded-lg px-2 py-0.5 text-xs font-bold', !org.isOpen ? 'bg-gray-100 text-ink-subtle' : org.waitMin < 10 ? 'bg-success-soft text-success-ink' : 'bg-brand-50 text-brand-700')}>
                          {!org.isOpen ? 'Fermé' : org.waitMin ? `~${org.waitMin} min` : 'Libre'}
                        </span>
                        {org.isOpen && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white" aria-hidden="true"><Plus size={15} strokeWidth={2.5} /></span>}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
