'use client'

import { useState, useEffect } from 'react'

const COUNTRIES = [
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+243', flag: '🇨🇩', name: 'RDC' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
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

  // Sync state if value is passed from parent initially
  useEffect(() => {
    if (value && localNum === '') {
      const matchedCountry = COUNTRIES.find(c => value.startsWith(c.code))
      if (matchedCountry) {
        setPrefix(matchedCountry.code)
        setLocalNum(value.slice(matchedCountry.code.length).trim())
      } else {
        setLocalNum(value)
      }
    }
  }, [value, localNum]) 

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNum = e.target.value
    setLocalNum(newNum)
    // Only send the prefix if they actually typed a number
    onChange(newNum ? `${prefix}${newNum}` : '')
  }

  const handlePrefixChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPrefix = e.target.value
    setPrefix(newPrefix)
    onChange(localNum ? `${newPrefix}${localNum}` : '')
  }

  return (
    <div className={`flex items-stretch bg-gray-50 border border-gray-200 rounded-xl focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all overflow-hidden ${className}`}>
      <div className="relative flex items-center bg-gray-100 border-r border-gray-200 hover:bg-gray-200 transition-colors">
        <select 
          value={prefix}
          onChange={handlePrefixChange}
          className="appearance-none bg-transparent outline-none pl-3 pr-8 py-3 text-gray-700 font-medium cursor-pointer w-full h-full relative z-10"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
        {/* Dropdown arrow icon positioned absolutely behind the select text */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      <input 
        type="tel"
        value={localNum}
        onChange={handleNumberChange}
        className="flex-1 bg-transparent px-4 py-3 outline-none text-lg font-medium text-gray-900 w-full min-w-0"
        placeholder="01 23 45 67 89"
      />
    </div>
  )
}
