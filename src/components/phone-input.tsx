'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

// Liste détaillée des pays d'Afrique (sans les exemples occidentaux)
const COUNTRIES = [
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+242', flag: '🇨🇬', name: 'Congo-Brazzaville' },
  { code: '+243', flag: '🇨🇩', name: 'République Démocratique du Congo' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: '+235', flag: '🇹🇩', name: 'Tchad' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar' },
]

export default function PhoneInput({ 
  value, 
  onChange, 
  className = "" 
}: { 
  value: string, 
  onChange: (val: string) => void,
  className?: string 
}) {
  const [prefix, setPrefix] = useState('+225')
  const [localNum, setLocalNum] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Synchronisation initiale si une valeur est passée (ex: profil utilisateur)
  useEffect(() => {
    if (value && localNum === '') {
      // Trouve le préfixe correspondant en triant par longueur (pour éviter les conflits +1 vs +12)
      const matchedCountry = [...COUNTRIES]
        .sort((a, b) => b.code.length - a.code.length)
        .find(c => value.startsWith(c.code))
        
      if (matchedCountry) {
        setPrefix(matchedCountry.code)
        setLocalNum(value.slice(matchedCountry.code.length).trim())
      } else {
        setLocalNum(value)
      }
    }
  }, [value, localNum]) 

  // Fermer le menu déroulant si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Nettoyer l'entrée (optionnel) pour ne garder que les chiffres et espaces
    const newNum = e.target.value.replace(/[^\d\s]/g, '')
    setLocalNum(newNum)
    onChange(newNum ? `${prefix}${newNum}` : '')
  }

  const selectCountry = (code: string) => {
    setPrefix(code)
    setIsOpen(false)
    onChange(localNum ? `${code}${localNum}` : '')
  }

  // Trouver le pays actif pour afficher son drapeau
  const activeCountry = COUNTRIES.find(c => c.code === prefix) || COUNTRIES[0]

  return (
    <div 
      ref={containerRef} 
      className={`relative flex items-stretch bg-gray-50 border border-gray-200 rounded-xl focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all ${className}`}
    >
      
      {/* Bouton du sélecteur personnalisé */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border-r border-gray-200 px-3 py-3 transition-colors rounded-l-xl focus:outline-none"
      >
        <span className="text-xl leading-none">{activeCountry.flag}</span>
        <span className="font-medium text-gray-700">{activeCountry.code}</span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu déroulant personnalisé */}
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[320px] bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl z-50 overflow-hidden flex flex-col transform opacity-100 scale-100 transition-all origin-top-left">
          <div className="max-h-[300px] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200">
            {COUNTRIES.map((c, idx) => (
              <button
                key={`${c.name}-${idx}`}
                type="button"
                onClick={() => selectCountry(c.code)}
                className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left
                  ${prefix === c.code ? 'bg-orange-50' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none shadow-sm rounded-sm">{c.flag}</span>
                  <span className={`font-medium ${prefix === c.code ? 'text-orange-600 font-bold' : 'text-gray-700'}`}>
                    {c.name}
                  </span>
                </div>
                {/* On garde l'indicatif à droite de façon discrète pour le professionnalisme */}
                <span className={`text-sm ${prefix === c.code ? 'text-orange-500' : 'text-gray-400'}`}>
                  {c.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Champ de saisie du numéro local */}
      <input 
        type="tel"
        value={localNum}
        onChange={handleNumberChange}
        className="flex-1 bg-transparent px-4 py-3 outline-none text-lg font-medium text-gray-900 w-full min-w-0 rounded-r-xl placeholder:text-gray-400"
        placeholder="01 23 45 67 89"
      />
    </div>
  )
}
