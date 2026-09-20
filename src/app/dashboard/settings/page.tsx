'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Dynamic import for Leaflet (SSR disabled)
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[400px] flex items-center justify-center bg-gray-100 animate-pulse rounded-2xl">
      <MapPin size={32} className="text-gray-300" />
    </div>
  )
})

export default function SettingsPage() {
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleLocationSelect = (newLat: number, newLng: number) => {
    setLat(newLat)
    setLng(newLng)
    setSaved(false)
  }

  const handleSave = () => {
    setIsSaving(true)
    // Simuler une sauvegarde vers l'API
    setTimeout(() => {
      setIsSaving(false)
      setSaved(true)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 p-4 sticky top-0 z-20 flex items-center gap-3">
        <Link href="/agent">
          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
            <ArrowLeft size={20} />
          </div>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-xs text-gray-500">Configuration de l'établissement</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full p-4 space-y-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Emplacement GPS</h2>
              <p className="text-sm text-gray-500 mt-1">
                Définissez la position exacte de votre établissement pour que les clients puissent vous trouver et que le bouclier anti-abus (Geofencing) fonctionne correctement.
              </p>
            </div>
          </div>
          
          <LocationPickerMap 
            onLocationSelect={handleLocationSelect} 
            initialLat={5.320357} 
            initialLng={-4.016107} 
          />

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {lat && lng ? (
                <>Coordonnées : <span className="font-mono text-gray-900">{lat.toFixed(5)}, {lng.toFixed(5)}</span></>
              ) : (
                "Aucune position modifiée"
              )}
            </div>
            <button 
              onClick={handleSave}
              disabled={!lat || isSaving || saved}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                saved ? 'bg-green-500 text-white' : 
                !lat ? 'bg-gray-200 text-gray-400' : 
                'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : saved ? (
                "Sauvegardé ! ✓"
              ) : (
                <><Save size={18} /> Enregistrer</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
