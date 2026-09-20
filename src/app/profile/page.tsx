'use client'
import Link from 'next/link'
import { ChevronRight, Bell, Shield, HelpCircle, LogOut, Clock, Star, User as UserIcon, BarChart3, Home, Compass, Ticket, Heart, X } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import UserProfileForm from '@/components/user-profile-form'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [showEditProfile, setShowEditProfile] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">
        {/* User card */}
        {status === 'loading' ? (
          <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-5 h-28"></div>
        ) : session?.user ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center text-white text-3xl font-bold">
              {session.user.image || session.user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-lg">{session.user.name || 'Utilisateur'}</p>
              <p className="text-sm text-gray-500">{session.user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                  {(session.user as any).role || 'CLIENT'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowEditProfile(true)}
              className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              Éditer
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-orange-100 bg-orange-50/50 p-5 text-center">
            <p className="text-gray-600 text-sm mb-3">Connectez-vous pour retrouver votre historique</p>
            <Link href="/auth/login" className="btn-primary py-2 px-6 inline-block">Se connecter</Link>
          </div>
        )}

        {showEditProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Modifier mon profil</h3>
                <button onClick={() => setShowEditProfile(false)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200">
                  <X size={18} />
                </button>
              </div>
              <UserProfileForm theme="orange" />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-orange-500">12</p>
            <p className="text-xs text-gray-500 mt-1">Tickets</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-blue-500">3</p>
            <p className="text-xs text-gray-500 mt-1">Favoris</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-black text-green-500">4.8h</p>
            <p className="text-xs text-gray-500 mt-1">Écon.</p>
          </div>
        </div>

        {/* Menu */}
        {[
          { icon: Bell,     label: 'Notifications',         href: '#', badge: '3' },
          { icon: Shield,   label: 'Confidentialité',        href: '#' },
          { icon: HelpCircle, label: 'Aide & Support',      href: '#' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100">
            <Link href={item.href}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <item.icon size={18} className="text-gray-500" />
                  <span className="font-medium text-gray-900 text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">{item.badge}</span>
                  )}
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            </Link>
          </div>
        ))}

        {/* Roles */}
        {session?.user && ((session.user as any).role === 'AGENT' || (session.user as any).role === 'MANAGER') && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Accès rapide</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/agent">
                <div className="bg-blue-50 rounded-xl p-3 text-center hover:bg-blue-100 transition-all">
                  <UserIcon size={32} className="mx-auto text-blue-500 mb-2" />
                  <p className="text-xs font-semibold text-blue-700">Interface Agent</p>
                </div>
              </Link>
              {(session.user as any).role === 'MANAGER' && (
                <Link href="/dashboard">
                  <div className="bg-orange-50 rounded-xl p-3 text-center hover:bg-orange-100 transition-all">
                    <BarChart3 size={32} className="mx-auto text-orange-500 mb-2" />
                    <p className="text-xs font-semibold text-orange-700">Dashboard</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {session?.user && (
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-100 text-red-500 font-medium text-sm hover:bg-red-50 transition-all"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        )}

        <p className="text-center text-xs text-gray-400">ATTENDS v1.0 · Ne perdez plus votre temps</p>
      </div>
      <BottomNav active="profile" />
    </div>
  )
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home', label: 'Accueil', href: '/home', icon: <Home size={20} /> },
    { id: 'explore', label: 'Explorer', href: '/explore', icon: <Compass size={20} /> },
    { id: 'tickets', label: 'Tickets', href: '/tickets', icon: <Ticket size={20} /> },
    { id: 'favorites', label: 'Favoris', href: '/favorites', icon: <Heart size={20} /> },
    { id: 'profile', label: 'Profil', href: '/profile', icon: <UserIcon size={20} /> },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${active === item.id ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active === item.id && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5"></span>}
            </div>
          </Link>
        ))}
      </div>
    </nav>
  )
}
