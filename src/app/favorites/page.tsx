'use client'

import { useState, useEffect } from 'react'
import { ListPageSkeleton } from '@/components/ui/skeletons'
import Link from 'next/link'
import { Heart, ChevronRight, Clock, Users, PlusSquare, Scissors, Home, Compass, Ticket, User, Utensils, Building2, AlertTriangle } from 'lucide-react'
import { getMyFavorites, toggleFavorite } from '@/server/actions/favorites'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ClientNav } from '@/components/navigation/client-nav'

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/favorites')
      return
    }
    if (status === 'authenticated') {
      fetchFavorites()
    }
  }, [status, router])

  const fetchFavorites = async () => {
    const data = await getMyFavorites()
    setFavorites(data)
    setLoading(false)
  }

  const handleRemoveFavorite = async (e: React.MouseEvent, orgId: string) => {
    e.preventDefault() // Prevent navigation to org page
    
    // Optimistic UI
    setFavorites(prev => prev.filter(f => f.id !== orgId))
    
    const res = await toggleFavorite(orgId)
    if (!res.success) {
      // Revert if error
      fetchFavorites()
    }
  }

  if (loading || status === 'loading') {
    return (
      <ListPageSkeleton />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Mes favoris</h1>
          <p className="text-sm text-gray-500 mt-1">Accédez rapidement à vos établissements préférés</p>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3 pb-24">
        {favorites.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center flex flex-col items-center">
            <Heart size={48} className="text-gray-200 mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Aucun favori</h2>
            <p className="text-gray-500 text-sm mb-6">Vous n'avez pas encore ajouté d'établissement à vos favoris.</p>
            <Link href="/explore">
              <button className="btn-primary py-2.5 px-6 rounded-xl">Explorer les établissements</button>
            </Link>
          </div>
        ) : (
          favorites.map((org) => (
            <Link key={org.id} href={`/org/${org.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${org.color}`}>
                  {org.category === 'Pharmacie' ? <PlusSquare size={24} /> : 
                   org.category === 'Beauté' ? <Scissors size={24} /> : 
                   org.category === 'Restauration' ? <Utensils size={24} /> : 
                   org.category === 'Banque' ? <Building2 size={24} /> : 
                   <PlusSquare size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 truncate pr-2">{org.name}</p>
                    <button 
                      onClick={(e) => handleRemoveFavorite(e, org.id)}
                      className="p-1 -mr-1 rounded-full hover:bg-gray-50"
                    >
                      <Heart size={16} className="fill-red-400 text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {org.isOpen ? (
                      <>
                        <span className="badge-open">Ouvert</span>
                        <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                          <Clock size={11} />{org.waitRange}
                        </span>
                      </>
                    ) : (
                      <span className="badge-closed">Fermé</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </Link>
          ))
        )}
      </div>
      <ClientNav />
    </div>
  )
}
