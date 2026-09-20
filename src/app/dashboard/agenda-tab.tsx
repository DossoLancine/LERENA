'use client'

import { useState, useEffect } from 'react'
import { Calendar, User, Phone, Edit2, CheckCircle2, XCircle } from 'lucide-react'
import { getAppointments, updateAppointmentStatus } from '@/app/actions/appointments'

export default function AgendaTab({ orgId }: { orgId: string }) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async () => {
    const res = await getAppointments(orgId)
    if (res.success && res.appointments) {
      setAppointments(res.appointments)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAppointments()
    const interval = setInterval(fetchAppointments, 15000)
    return () => clearInterval(interval)
  }, [orgId])

  const handleUpdateStatus = async (id: string, status: string) => {
    await updateAppointmentStatus(id, status)
    fetchAppointments()
  }

  if (loading) {
    return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Agenda des Rendez-vous</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
            <p>Aucun rendez-vous planifié.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {appointments.map((appt) => (
              <div key={appt.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {new Date(appt.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm font-medium text-orange-600 mt-0.5">{appt.service?.name}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <User size={14} className="text-gray-400" />
                        {appt.user?.name || appt.guestName || "Client"}
                      </div>
                      {(appt.user?.phone || appt.guestPhone) && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone size={14} className="text-gray-400" />
                          {appt.user?.phone || appt.guestPhone}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      appt.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {appt.status}
                    </span>
                    
                    {appt.status === 'CONFIRMED' && (
                      <div className="flex items-center gap-1 mt-1">
                        <button onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
