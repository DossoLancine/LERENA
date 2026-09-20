'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation } from 'lucide-react'
import { renderToString } from 'react-dom/server'

// Center map component
function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, map.getZoom())
  }, [center, map])
  return null
}

export default function LocationPickerMap({ 
  initialLat, 
  initialLng, 
  onLocationSelect 
}: { 
  initialLat?: number, 
  initialLng?: number, 
  onLocationSelect: (lat: number, lng: number) => void 
}) {
  const defaultPosition: [number, number] = [5.320357, -4.016107] // Abidjan default
  const [position, setPosition] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : defaultPosition
  )
  const markerRef = useRef<any>(null)

  // Custom draggable marker
  const markerIcon = useMemo(() => {
    const iconHtml = renderToString(<MapPin size={28} className="text-white" />)
    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative flex items-center justify-center w-12 h-12 bg-orange-500 rounded-full shadow-[0_10px_20px_rgba(249,115,22,0.4)] border-4 border-white cursor-grab active:cursor-grabbing">
          ${iconHtml}
          <div class="absolute -bottom-2 w-3 h-3 bg-orange-500 rotate-45 border-r-4 border-b-4 border-white"></div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 52],
    })
  }, [])

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          const newPos = marker.getLatLng()
          setPosition([newPos.lat, newPos.lng])
          onLocationSelect(newPos.lat, newPos.lng)
        }
      },
    }),
    [onLocationSelect]
  )

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setPosition(newPos)
          onLocationSelect(newPos[0], newPos[1])
        },
        (err) => {
          alert("Impossible de récupérer votre position. Veuillez vérifier vos autorisations.")
        }
      )
    }
  }

  return (
    <div className="w-full h-full relative flex flex-col gap-3">
      <button 
        type="button"
        onClick={handleUseMyLocation}
        className="flex items-center justify-center gap-2 w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 rounded-xl transition-colors"
      >
        <Navigation size={18} />
        Utiliser ma position actuelle
      </button>

      <div className="flex-1 rounded-2xl overflow-hidden border-2 border-gray-200 relative min-h-[400px]">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md text-sm font-semibold text-gray-700 pointer-events-none">
          Déplacez le marqueur pour ajuster
        </div>
        
        <MapContainer 
          center={position} 
          zoom={15} 
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapController center={position} />
          
          <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
            icon={markerIcon}
          >
            <Popup>Votre établissement sera affiché ici.</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}
