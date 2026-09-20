'use client'

import { useState } from 'react'
import { Calendar, Clock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createAppointment } from '@/app/actions/appointments'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function AppointmentBookingForm({ orgId, serviceId, orgName }: { orgId: string, serviceId: string | null, orgName: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate some dummy slots for the demo (every 30 mins from 9am to 5pm)
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ]

  // Next 7 days
  const getNextDays = () => {
    const days = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      // Skip sunday
      if (d.getDay() !== 0) {
        days.push({
          date: d.toISOString().split('T')[0],
          dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
          dayNum: d.getDate()
        })
      }
    }
    return days
  }
  const nextDays = getNextDays()

  const handleBook = async () => {
    if (!serviceId) {
      setError("Veuillez sélectionner un service d'abord.")
      return
    }
    if (!selectedDate || !selectedTime) {
      setError("Veuillez sélectionner une date et une heure.")
      return
    }

    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/org/${orgId}`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Construct full date
    const [hours, minutes] = selectedTime.split(':')
    const scheduledDate = new Date(selectedDate)
    scheduledDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

    const res = await createAppointment(orgId, serviceId, scheduledDate)
    
    if (res.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/tickets') // Redirect to tickets/appointments list page (to be renamed/adapted)
      }, 2000)
    } else {
      setError(res.error || "Erreur lors de la réservation.")
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-green-100 p-6 mb-4 text-center">
        <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">Rendez-vous confirmé !</h3>
        <p className="text-sm text-gray-500">Votre réservation chez {orgName} est validée.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Calendar size={18} className="text-orange-500" />
        Choisir une date
      </h2>
      
      {/* Date Selector (Horizontal Scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar mb-4">
        {nextDays.map((day) => (
          <button
            key={day.date}
            onClick={() => { setSelectedDate(day.date); setSelectedTime('') }}
            className={`flex flex-col items-center justify-center p-3 min-w-[70px] rounded-xl border-2 transition-all ${
              selectedDate === day.date
                ? 'border-orange-500 bg-orange-50 text-orange-600'
                : 'border-gray-100 hover:border-gray-200 text-gray-600'
            }`}
          >
            <span className="text-xs font-medium uppercase">{day.dayName}</span>
            <span className="text-xl font-bold">{day.dayNum}</span>
          </button>
        ))}
      </div>

      {selectedDate && (
        <>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 mt-2">
            <Clock size={18} className="text-orange-500" />
            Heures disponibles
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`py-2 px-1 text-sm font-semibold rounded-lg border-2 transition-all ${
                  selectedTime === time
                    ? 'border-orange-500 bg-orange-50 text-orange-600'
                    : 'border-gray-100 hover:border-gray-200 text-gray-700'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm text-center rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={handleBook}
        disabled={!selectedDate || !selectedTime || isSubmitting || !serviceId}
        className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="animate-pulse">Réservation...</span>
        ) : (
          <>Valider le Rendez-vous <ChevronRight size={16} /></>
        )}
      </button>
    </div>
  )
}
