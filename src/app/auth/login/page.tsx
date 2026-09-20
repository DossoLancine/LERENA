'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Zap, Briefcase, Headphones, User } from 'lucide-react'
import PhoneInput from '@/components/phone-input'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await signIn('credentials', {
        redirect: false,
        identifier: email.trim(),
        password
      })

      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Identifiants incorrects' : res.error)
        setIsLoading(false)
        return
      }

      if (res?.ok) {
        if (callbackUrl) {
          router.push(callbackUrl)
        } else {
          // Fetch session to determine correct destination
          const sessionRes = await fetch('/api/auth/session')
          const session = await sessionRes.json()
          const role = (session?.user as any)?.role

          if (role === 'MANAGER') {
            router.push('/dashboard')
          } else if (role === 'AGENT') {
            router.push('/agent')
          } else {
            router.push('/explore')
          }
        }
        router.refresh()
      } else {
        setError('Impossible de se connecter. Veuillez vérifier vos identifiants.')
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Erreur lors de la connexion')
      setIsLoading(false)
    }
  }

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('password123')
    setError('')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="p-4 flex items-center justify-between">
        <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="text-orange-500 font-bold flex items-center gap-1">
          <Clock size={20} /> ATTENDS
        </div>
      </div>
      
      <div className="flex-1 px-6 py-6 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 mb-1">Bon retour !</h1>
          <p className="text-gray-500 text-sm">Connectez-vous pour accéder à votre espace.</p>
        </div>

        {/* Comptes Démo Rapides (Client uniquement) */}
        <div className="mb-5 p-3.5 bg-orange-50/70 border border-orange-100 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800 uppercase tracking-wider">
              <Zap size={14} className="text-orange-500" />
              <span>Accès rapide démo :</span>
            </div>
            <button
              type="button"
              onClick={() => fillDemo('+2250000000000')}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-orange-200 text-xs font-semibold text-gray-800 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
            >
              <User size={14} />
              <span>Remplir Client</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
            <PhoneInput 
              value={email} 
              onChange={setEmail}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code PIN</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all text-lg tracking-widest"
              placeholder="••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-black text-white hover:bg-gray-800 rounded-2xl font-bold py-4 mt-6 flex justify-center items-center transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : "Continuer"}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500">
          Nouveau sur ATTENDS ?{' '}
          <Link href="/auth/register" className="font-bold text-orange-500">Créer un compte</Link>
        </p>

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Vous êtes un établissement partenaire ?<br/>
            <Link href="/pro/login" className="text-slate-900 font-bold hover:underline mt-1 inline-block">
              Accéder au portail Pro
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  )
}
