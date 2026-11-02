'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, acceptTerms: accepted })
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#fde3cc] via-[#fff6ef] via-30% to-white">
      <div className="p-4 flex items-center justify-between">
        <Link href="/auth/login" aria-label="Retour" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-black/5">
          <ArrowLeft size={20} />
        </Link>
        <span className="flex items-center gap-1 font-display text-xl font-extrabold text-ink">Lerena <Zap size={17} className="fill-brand text-brand" /></span>
      </div>
      
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-tight text-ink">Créez votre compte</h1>
          <p className="mt-1 text-sm text-ink-muted">Trente secondes, et vos tickets vous suivent partout.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
            <PhoneInput id="register-phone"
              value={phone} 
              onChange={setPhone}
            />
          </div>
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input 
              id="register-name"
              autoComplete="name"
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 text-lg font-medium"
              placeholder="Ex: Aminata S."
            />
          </div>
          <div>
            <label htmlFor="register-pin" className="block text-sm font-medium text-gray-700 mb-1">Code PIN (6 chiffres)</label>
            <input 
              id="register-pin"
              type="password"
              autoComplete="new-password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 text-lg tracking-widest"
              placeholder="••••••"
              minLength={6}
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-600">

            <input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />

            <span>J’accepte les <Link href="/legal/cgu" target="_blank" className="font-semibold text-orange-700 underline">conditions d’utilisation</Link> et la <Link href="/legal/confidentialite" target="_blank" className="font-semibold text-orange-700 underline">politique de confidentialité</Link>.</span>

          </label>


          <button 
            type="submit" 
            disabled={isLoading}
            className="pressable w-full rounded-2xl bg-gradient-to-br from-[#fb923c] to-brand py-4 mt-2 flex justify-center items-center font-bold text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)] transition-all disabled:opacity-60"
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
