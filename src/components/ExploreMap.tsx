'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, PlusSquare, Scissors, Utensils, Building2, ChevronRight, Clock } from 'lucide-react'
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
  // Default center (Abidjan if no location)
  const defaultCenter: [number, number] = [5.320357, -4.016107]

  // Create custom icons for orgs
  const createOrgIcon = (org: any) => {
    let iconStr = ''
    let colorClass = ''

    if (org.category === 'Pharmacie') {
      iconStr = renderToString(<PlusSquare size={18} className="text-white" />)
      colorClass = 'bg-green-500'
    } else if (org.category === 'Beauté') {
      iconStr = renderToString(<Scissors size={18} className="text-white" />)
      colorClass = 'bg-pink-500'
    } else if (org.category === 'Restauration') {
      iconStr = renderToString(<Utensils size={18} className="text-white" />)
      colorClass = 'bg-orange-500'
    } else if (org.category === 'Banque') {
      iconStr = renderToString(<Building2 size={18} className="text-white" />)
      colorClass = 'bg-gray-600'
    } else {
      iconStr = renderToString(<PlusSquare size={18} className="text-white" />)
      colorClass = 'bg-blue-500'
    }

    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative group cursor-pointer flex items-center justify-center w-10 h-10 ${colorClass} rounded-full shadow-lg border-2 border-white transform transition-transform hover:scale-110">
          ${iconStr}
          <div class="absolute -bottom-1 w-2 h-2 ${colorClass} rotate-45 border-r-2 border-b-2 border-white"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 42],
      popupAnchor: [0, -45]
    })
  }

  return (
    <div className="w-full h-[calc(100vh-140px)] relative z-0">
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
            icon={createOrgIcon(org)}
          >
            <Popup className="custom-popup" minWidth={250}>
              <div className="p-1">
                <p className="font-bold text-gray-900 text-base mb-1">{org.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <span className="flex items-center gap-1 text-orange-500 font-bold">
                    <Clock size={12} /> {org.waitRange}
                  </span>
                  <span>•</span>
                  <span>{org.distance}</span>
                </div>
                <Link href={`/org/${org.id}`}>
                  <button className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-1">
                    Prendre un ticket <ChevronRight size={14} />
                  </button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Global styles for Leaflet Popup overriding */}
      <style jsx global>{`
        .map-tiles {
          filter: grayscale(1) opacity(0.6) contrast(1.2);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        .leaflet-popup-content {
          margin: 12px;
        }
        .leaflet-container a.leaflet-popup-close-button {
          padding: 8px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}
