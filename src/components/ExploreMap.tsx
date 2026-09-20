'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, PlusSquare, Scissors, Utensils, Building2, ChevronRight, Clock, Users, X, Navigation } from 'lucide-react'
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

  // Icône Premium pour le visiteur (Style Radar/GPS moderne)
  const userIcon = L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative flex items-center justify-center w-16 h-16">
        <div class="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-ping"></div>
        <div class="absolute w-5 h-5 bg-blue-600 border-4 border-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.3)] z-10 flex items-center justify-center">
          <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  })

  return <Marker position={[location.lat, location.lng]} icon={userIcon} zIndexOffset={1000} />
}

export default function ExploreMap({ orgs, userLocation }: { orgs: any[], userLocation: { lat: number, lng: number } | null }) {
  const [activeOrg, setActiveOrg] = useState<any | null>(null)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])
  const [routeData, setRouteData] = useState<{distance: string, duration: string} | null>(null)
  const [isRouting, setIsRouting] = useState(false)
  
  // Default center (Abidjan if no location)
  const defaultCenter: [number, number] = [5.320357, -4.016107]

  // Fetch real route from OSRM when activeOrg changes
  useEffect(() => {
    if (!activeOrg || !userLocation) {
      setRouteCoords([])
      setRouteData(null)
      return
    }

    const fetchRoute = async () => {
      setIsRouting(true)
      try {
        // OSRM Public API (lon,lat format)
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${activeOrg.lng},${activeOrg.lat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        const data = await res.json()
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0]
          // GeoJSON returns [lon, lat], Leaflet needs [lat, lon]
          const coords = route.geometry.coordinates.map((c: any) => [c[1], c[0]])
          setRouteCoords(coords)

          const distKm = (route.distance / 1000).toFixed(1)
          const durMin = Math.round(route.duration / 60)
          setRouteData({ distance: `${distKm} km`, duration: `${durMin} min` })
        }
      } catch (err) {
        console.error("Erreur de calcul d'itinéraire OSRM :", err)
      } finally {
        setIsRouting(false)
      }
    }

    fetchRoute()
  }, [activeOrg, userLocation])

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

    const scaleClass = isActive ? 'scale-125 ring-4 ring-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] z-[9999]' : 'hover:scale-110 shadow-lg border-2 border-white'

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

        {/* Ligne d'itinéraire réelle (Style Uber / Google Maps) */}
        {routeCoords.length > 0 && (
          <>
            {/* Bordure de la ligne (Ombre) */}
            <Polyline 
              positions={routeCoords} 
              pathOptions={{ color: '#1e40af', weight: 8, opacity: 0.3, lineCap: 'round', lineJoin: 'round' }} 
            />
            {/* Trait principal */}
            <Polyline 
              positions={routeCoords} 
              pathOptions={{ color: '#3b82f6', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} 
            />
          </>
        )}

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
                map.setView([org.lat - 0.008, org.lng], 14, { animate: true })
              }
            }}
          />
        ))}
      </MapContainer>

      {/* Floating Card UI (Professional Interaction) */}
      {activeOrg && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000] transition-all duration-300 transform translate-y-0 opacity-100 pb-safe">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 border border-gray-100 relative">
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
              <div className="bg-blue-50 rounded-xl p-2 text-center">
                <span className="block text-blue-600 font-bold flex items-center justify-center gap-1 text-sm">
                  {isRouting ? (
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <><Navigation size={12} className="shrink-0" /> {routeData ? routeData.duration : activeOrg.distance}</>
                  )}
                </span>
                <span className="text-[10px] text-blue-500 uppercase font-bold tracking-wider">Trajet</span>
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
