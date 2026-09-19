'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { getAnalyticsSummary, type AnalyticsSummary } from '../actions/analytics'
import { TrendingUp, TrendingDown, Clock, UserX, CheckCircle2, BarChart3 } from 'lucide-react'

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalyticsSummary().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-gray-500">Impossible de charger les analytiques.</p>
        <p className="text-gray-400 text-sm mt-1">Vérifiez que vous êtes bien connecté en tant que Manager.</p>
      </div>
    )
  }

  // Peak hour
  const peak = data.hourlyAffluence.reduce((a, b) => (b.count > a.count ? b : a), data.hourlyAffluence[0])

  // Only show hours with activity for cleaner chart (or show business hours 7-21)
  const chartData = data.hourlyAffluence.filter(h => h.hour >= 7 && h.hour <= 20)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Completed */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <TrendingUp size={14} className="text-green-500" />
          </div>
          <p className="text-3xl font-black text-gray-900">{data.completedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Tickets servis</p>
        </div>

        {/* Drop-off */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <UserX size={18} className="text-red-500" />
            {data.dropOffRate > 10 ? (
              <TrendingUp size={14} className="text-red-500" />
            ) : (
              <TrendingDown size={14} className="text-green-500" />
            )}
          </div>
          <p className="text-3xl font-black text-gray-900">{data.dropOffRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Taux d&apos;abandon ({data.dropOffCount} clients)</p>
        </div>
      </div>

      {/* AHT by Service */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-blue-500" />
          <h3 className="font-semibold text-gray-900">Temps moyen de traitement (AHT)</h3>
        </div>
        {data.aht.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-gray-400 text-sm">Aucun ticket complété avec données de durée.</p>
            <p className="text-gray-300 text-xs mt-1">Les données apparaîtront quand les agents complèteront des tickets.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.aht.map(svc => (
              <div key={svc.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{svc.name}</span>
                  <span className="text-sm font-bold text-blue-600">{svc.avgMinutes} min</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                    style={{ width: `${Math.min((svc.avgMinutes / 60) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{svc.count} ticket{svc.count > 1 ? 's' : ''} traité{svc.count > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Affluence Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-orange-500" />
            <h3 className="font-semibold text-gray-900">Affluence par heure</h3>
          </div>
          {peak.count > 0 && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              Pic : {peak.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">Nombre de tickets créés selon l&apos;heure de la journée</p>

        {data.totalTickets === 0 ? (
          <div className="py-6 text-center">
            <p className="text-gray-400 text-sm">Aucun ticket créé pour le moment.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                formatter={(value: number) => [`${value} tickets`, 'Volume']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.hour === peak.hour && peak.count > 0 ? '#f97316' : '#fed7aa'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
