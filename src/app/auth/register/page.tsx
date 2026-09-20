'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password })
      })

      if (res.ok) {
        let redirectUrl = '/auth/login?registered=true'
        if (callbackUrl) {
          redirectUrl += `&callbackUrl=${encodeURIComponent(callbackUrl)}`
        }
        router.push(redirectUrl)
      } else {
        const data = await res.json()
        setError(data.message || 'Une erreur est survenue')
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="p-4 flex items-center justify-between">
        <Link href="/auth/login" className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="text-orange-500 font-bold flex items-center gap-1">
          <Clock size={20} /> ATTENDS
        </div>
      </div>
      
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Créez votre compte</h1>
          <p className="text-gray-500">Rejoignez une file d&apos;attente en un clic.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
            <input 
              type="tel" 
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all text-lg font-medium"
              placeholder="+225 00 00 00 00 00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all text-lg font-medium"
              placeholder="Ex: Aminata S."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code PIN (6 chiffres)</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all text-lg tracking-widest"
              placeholder="••••••"
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-black text-white hover:bg-gray-800 rounded-2xl font-bold py-4 mt-4 flex justify-center items-center transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : "Continuer"}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/auth/login" className="font-bold text-orange-500">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
