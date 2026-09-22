'use client'

import { useState, useEffect } from 'react'
import { Users, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, BarChart3, Settings, ChevronRight, Activity, User as UserIcon, X, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Skeleton réutilisable affiché pendant qu'un onglet charge son JS
const TabSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
    </div>
    <div className="h-48 bg-gray-100 rounded-2xl" />
    <div className="h-32 bg-gray-100 rounded-2xl" />
  </div>
)

// Chargement paresseux (lazy) de chaque onglet lourd — skeleton affiché pendant le chargement
const AnalyticsTab = dynamic(() => import('./analytics-tab'), { ssr: false, loading: () => <TabSkeleton /> })
const PromotionsTab = dynamic(() => import('./promotions-tab'), { ssr: false, loading: () => <TabSkeleton /> })
const SettingsTab = dynamic(() => import('./settings-tab'), { ssr: false, loading: () => <TabSkeleton /> })
const ServicesTab = dynamic(() => import('./services-tab'), { ssr: false, loading: () => <TabSkeleton /> })
const AgendaTab = dynamic(() => import('./agenda-tab'), { ssr: false, loading: () => <TabSkeleton /> })
import UserProfileForm from '@/components/user-profile-form'

const statusBadge: Record<string, string> = {
  SERVING: 'badge-serving',
  WAITING: 'badge-waiting',
  CALLED:  'badge-called',
  COMPLETED: 'bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold',
  ABSENT: 'bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold',
  CANCELLED: 'bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold',
}
const statusLabel: Record<string, string> = {
  SERVING: 'En service',
  WAITING: 'En attente',
  CALLED:  'Appelé',
  COMPLETED: 'Terminé',
  ABSENT: 'Absent',
  CANCELLED: 'Annulé',
}

import { getManagerStats, toggleOrganizationStatus, getLiveQueue, getOrganizationServices } from '../actions/manager'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'agenda' | 'services' | 'analytics' | 'marketing' | 'settings'>('overview')
  const [stats, setStats] = useState<any>(null)
  const [liveQueue, setLiveQueue] = useState<any[]>([])
  const [orgServices, setOrgServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditProfile, setShowEditProfile] = useState(false)

  const fetchStats = async () => {
    try {
      const [data, queueData, servicesData] = await Promise.all([
        getManagerStats(),
        getLiveQueue(),
        getOrganizationServices()
      ])
      setStats(data)
      setLiveQueue(queueData || [])
      setOrgServices(servicesData || [])
    } catch (e) {
      console.error("Dashboard fetch error:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  const handleToggleOpen = async () => {
    if (!stats) return
    const success = await toggleOrganizationStatus(stats.orgId, !stats.isOpen)
    if (success) {
      setStats({ ...stats, isOpen: !stats.isOpen })
    }
  }

  const totalWaiting = stats?.currentWaiting || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Tableau de bord</p>
            <h1 className="text-lg font-bold text-gray-900">Administration</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleToggleOpen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${stats?.isOpen ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-red-50 border-red-200 hover:bg-red-100'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats?.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className={`text-xs font-medium ${stats?.isOpen ? 'text-green-600' : 'text-red-600'}`}>{stats?.isOpen ? 'Ouvert' : 'Fermé'}</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'settings' ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Paramètres de l'établissement"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => setShowEditProfile(true)}
              className="w-9 h-9 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
              title="Mon Profil (Manager)"
            >
              <UserIcon size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto pb-3">
          {(['overview', 'queue', 'agenda', 'services', 'analytics', 'marketing', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {{ overview: 'Vue d\'ensemble', queue: 'File', agenda: 'Agenda', services: 'Services', analytics: 'Analytiques', marketing: 'Promotions', settings: 'Paramètres' }[tab]}
            </button>
          ))}
        </div>
      </div>

      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto shadow-xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Mon Profil (Manager)</h3>
              <button onClick={() => setShowEditProfile(false)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>
            <UserProfileForm theme="orange" />
            <button 
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-100 text-red-500 font-medium text-sm hover:bg-red-50 transition-all mt-2"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-8">
        {activeTab === 'overview' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <Users size={18} className="text-orange-500" />
                  <TrendingUp size={14} className="text-green-500" />
                </div>
                <p className="text-3xl font-black text-gray-900">{totalWaiting}</p>
                <p className="text-xs text-gray-500 mt-1">En file</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <Clock size={18} className="text-blue-500" />
                  <span className="text-xs text-amber-500 font-medium">+3 min</span>
                </div>
                <p className="text-3xl font-black text-gray-900">31</p>
                <p className="text-xs text-gray-500 mt-1">Min d&apos;attente</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 size={18} className="text-green-500" />
                  <TrendingUp size={14} className="text-green-500" />
                </div>
                <p className="text-3xl font-black text-gray-900">{stats?.completedTickets || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Terminés</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <Activity size={18} className="text-purple-500" />
                </div>
                <p className="text-3xl font-black text-gray-900">{stats?.todayTickets || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total pris</p>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Temps d&apos;attente élevé</p>
                <p className="text-xs text-amber-600 mt-0.5">La file Pédiatrie dépasse 25 min. Envisagez d&apos;affecter un agent supplémentaire.</p>
              </div>
            </div>

            {/* Current queue preview */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">File en direct</h2>
                <button onClick={() => setActiveTab('queue')} className="text-sm text-orange-500 font-medium">Tout voir</button>
              </div>
              {liveQueue.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Aucun ticket actif pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {liveQueue.slice(0, 5).map((ticket) => (
                    <div key={ticket.id || ticket.num} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-gray-700 w-14">{ticket.num}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.name}</p>
                          <p className="text-xs text-gray-500">{ticket.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={statusBadge[ticket.status] || 'badge-waiting'}>{statusLabel[ticket.status] || ticket.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Services overview */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Services configurés ({orgServices.length})</h2>
                <button onClick={() => setActiveTab('services')} className="text-sm text-orange-500 font-medium">Détails</button>
              </div>
              {orgServices.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Aucun service configuré.
                </div>
              ) : (
                orgServices.map((svc) => (
                  <div key={svc.id || svc.name} className="px-5 py-4 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 text-sm">{svc.name}</p>
                      <span className="text-xs text-gray-500">{svc.completedToday || 0} servis auj.</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users size={11} />{svc.count} en attente</span>
                      <span className="flex items-center gap-1"><Clock size={11} />~{svc.avgMin} min</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'queue' && (
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">File complète en direct</h2>
              <span className="text-sm text-gray-500">{liveQueue.length} tickets</span>
            </div>
            {liveQueue.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Users size={36} className="mx-auto mb-2 text-gray-300" />
                <p className="font-semibold text-sm text-gray-600">Aucun ticket dans la file</p>
                <p className="text-xs text-gray-400 mt-1">Les tickets pris par les clients apparaîtront ici en temps réel.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {liveQueue.map((ticket, i) => (
                  <div key={ticket.id || ticket.num} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        ticket.status === 'SERVING' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>{i + 1}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-gray-700">{ticket.num}</span>
                          <span className="text-sm text-gray-900">— {ticket.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{ticket.service}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={statusBadge[ticket.status] || 'badge-waiting'}>{statusLabel[ticket.status] || ticket.status}</span>
                      {ticket.wait > 0 && (
                        <p className="text-xs text-gray-400 mt-1">~{ticket.wait} min</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'agenda' && stats?.orgId && (
          <AgendaTab orgId={stats.orgId} />
        )}

        {activeTab === 'services' && (
          <ServicesTab />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}

        {activeTab === 'marketing' && (
          <PromotionsTab />
        )}

        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  )
}
