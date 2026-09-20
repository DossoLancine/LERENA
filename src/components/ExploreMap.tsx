'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, PlusSquare, Scissors, Utensils, Building2, ChevronRight, Clock, Users, X } from 'lucide-react'
import Link from 'next/link'
import { renderToString } from 'react-dom/server'

// Custom component to handle map center based on user location
function LocationMarker({ location }: { location: { lat: number, lng: number } | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 13)
    }
  }, [location, map])

  if (!location) return null

  // User location icon (blue dot)
  const userIcon = L.divIcon({
    className: 'bg-transparent',
    html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

  return <Marker position={[location.lat, location.lng]} icon={userIcon} />
}

export default function ExploreMap({ orgs, userLocation }: { orgs: any[], userLocation: { lat: number, lng: number } | null }) {
  const [activeOrg, setActiveOrg] = useState<any | null>(null)
  
  // Default center (Abidjan if no location)
  const defaultCenter: [number, number] = [5.320357, -4.016107]

  // Create custom icons for orgs
  const createOrgIcon = (org: any, isActive: boolean) => {
    let iconStr = ''
    let colorClass = ''

    if (org.category === 'Pharmacie') {
      iconStr = renderToString(<PlusSquare size={isActive ? 22 : 18} className="text-white" />)
      colorClass = 'bg-green-500'
    } else if (org.category === 'Beauté') {
      iconStr = renderToString(<Scissors size={isActive ? 22 : 18} className="text-white" />)
      colorClass = 'bg-pink-500'
    } else if (org.category === 'Restauration') {
      iconStr = renderToString(<Utensils size={isActive ? 22 : 18} className="text-white" />)
      colorClass = 'bg-orange-500'
    } else if (org.category === 'Banque') {
      iconStr = renderToString(<Building2 size={isActive ? 22 : 18} className="text-white" />)
      colorClass = 'bg-gray-600'
    } else {
      iconStr = renderToString(<PlusSquare size={isActive ? 22 : 18} className="text-white" />)
      colorClass = 'bg-blue-500'
    }

    const scaleClass = isActive ? 'scale-125 ring-4 ring-white shadow-2xl z-50' : 'hover:scale-110 shadow-lg border-2 border-white'

    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative group cursor-pointer flex items-center justify-center w-10 h-10 ${colorClass} rounded-full transform transition-all duration-300 ${scaleClass}">
          ${iconStr}
          <div class="absolute -bottom-1 w-2 h-2 ${colorClass} rotate-45 border-r-2 border-b-2 border-white"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 42]
    })
  }

  return (
    <div className="w-full h-[calc(100vh-140px)] relative z-0 overflow-hidden">
      <MapContainer 
        center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter} 
        zoom={13} 
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          className="map-tiles"
        />
        
        <LocationMarker location={userLocation} />

        {orgs.filter(o => o.lat && o.lng).map((org) => (
          <Marker 
            key={org.id} 
            position={[org.lat, org.lng]}
            icon={createOrgIcon(org, activeOrg?.id === org.id)}
            eventHandlers={{
              click: (e) => {
                setActiveOrg(org)
                const map = e.target._map
                // Recentrer légèrement plus bas pour que la carte n'écrase pas le marqueur
                map.setView([org.lat - 0.005, org.lng], 15, { animate: true })
              }
            }}
          />
        ))}
      </MapContainer>

      {/* Floating Card UI (Professional Interaction) */}
      {activeOrg && (
        <div className="absolute bottom-6 left-4 right-4 z-[1000] transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 border border-gray-100">
            <button 
              onClick={() => setActiveOrg(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1 transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activeOrg.color}`}>
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 leading-tight pr-6">{activeOrg.name}</h3>
                <p className="text-sm text-gray-500 font-medium">{activeOrg.category}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <span className="block text-orange-500 font-bold flex items-center justify-center gap-1 text-sm">
                  <Clock size={14} /> {activeOrg.waitRange.split('-')[0]}m
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Attente</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <span className="block text-gray-900 font-bold flex items-center justify-center gap-1 text-sm">
                  <Users size={14} /> {activeOrg.queueCount || 0}
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">En file</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <span className="block text-gray-900 font-bold flex items-center justify-center gap-1 text-sm">
                  <MapPin size={14} /> {activeOrg.distance}
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Distance</span>
              </div>
            </div>

            <Link href={`/org/${activeOrg.id}`} className="block">
              <button className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-md">
                Voir l'établissement <ChevronRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      )}
      
      {/* Global styles for Leaflet */}
      <style jsx global>{`
        .map-tiles {
          filter: saturate(0.4) brightness(1.1) contrast(0.9) sepia(0.1);
        }
      `}</style>
    </div>
  )
}
