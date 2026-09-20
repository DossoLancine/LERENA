'use client'

import { useState, useEffect } from 'react'
import { updateUserProfile, getUserProfile } from '@/app/actions/user'
import { User as UserIcon, Phone, Mail, Lock, Save, Loader2, CheckCircle2 } from 'lucide-react'

export default function UserProfileForm({ theme = 'orange' }: { theme?: 'orange' | 'blue' | 'indigo' }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  })
  const avatars = ['👨', '👩', '🧑', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '🦸‍♂️', '🦸‍♀️', '🥷', '🐶', '🐱', '🐼']
  const [selectedAvatar, setSelectedAvatar] = useState('')

  useEffect(() => {
    async function loadData() {
      const user = await getUserProfile()
      if (user) {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          password: ''
        })
        setSelectedAvatar(user.image || '')
        setRole(user.role)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    
    try {
      await updateUserProfile({
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        image: selectedAvatar
      })
      setSuccess(true)
      // Reset password field after save
      setFormData(prev => ({ ...prev, password: '' }))
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className={`animate-spin text-${theme}-500`} size={24} />
      </div>
    )
  }

  const themeColors = {
    orange: 'focus:ring-orange-500 focus:border-orange-500 bg-orange-500 hover:bg-orange-600',
    blue: 'focus:ring-blue-500 focus:border-blue-500 bg-blue-600 hover:bg-blue-700',
    indigo: 'focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-600 hover:bg-indigo-700'
  }

  const buttonClass = `w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-medium transition-all ${themeColors[theme].split(' ').slice(2).join(' ')} disabled:opacity-50`
  const inputClass = `w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 bg-gray-50 focus:bg-white transition-all ${themeColors[theme].split(' ').slice(0, 2).join(' ')}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      <div className="flex flex-col gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 items-center text-center">
        <div className={`w-16 h-16 rounded-2xl bg-${theme}-100 flex items-center justify-center text-${theme}-600 font-bold text-3xl shadow-sm`}>
          {selectedAvatar || formData.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <p className="font-bold text-gray-900">{formData.name || 'Utilisateur'}</p>
          <p className="text-xs font-semibold text-gray-500 mb-2">{role}</p>
        </div>
        <div className="w-full">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Choisir un avatar</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center flex-wrap">
            {avatars.map(a => (
              <button 
                key={a}
                type="button"
                onClick={() => setSelectedAvatar(a)}
                className={`text-xl p-1.5 rounded-full transition-all ${selectedAvatar === a ? `bg-${theme}-200 scale-110 shadow-sm` : 'hover:bg-gray-200 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet</label>
          <div className="relative">
            <UserIcon size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={inputClass}
              placeholder="Votre nom"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse Email (Lecture seule)</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="email" 
              value={formData.email}
              disabled
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="tel" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className={inputClass}
              placeholder="+33 6 00 00 00 00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nouveau mot de passe</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={inputClass}
              placeholder="Laisser vide pour ne pas changer"
            />
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={saving}
        className={buttonClass}
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : success ? (
          <><CheckCircle2 size={18} /> Enregistré</>
        ) : (
          <><Save size={18} /> Mettre à jour</>
        )}
      </button>
    </form>
  )
}
