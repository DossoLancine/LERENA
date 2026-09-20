'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

function ProLoginForm() {
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
        identifier: email.trim(), // Le backend gère identifier
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
            // Si un client arrive ici par erreur
            router.push('/explore')
          }
        }
        router.refresh()
      } else {
        setError('Impossible de se connecter.')
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Erreur système')
      setIsLoading(false)
    }
  }

  const fillDemo = (role: 'manager' | 'agent') => {
    setEmail(`${role}@attends.com`)
    setPassword('password123')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Côté gauche : Illustration / Branding B2B */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-wider">ATTENDS <span className="font-light text-slate-400">BUSINESS</span></span>
          </div>
          <h1 className="text-4xl font-bold mb-6 leading-tight">
            Gérez vos flux d'accueil<br />avec précision.
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            L'espace professionnel dédié aux managers et agents pour superviser les files d'attente, analyser les performances et fluidifier l'expérience client.
          </p>
        </div>
        
        <div className="relative z-10 flex items-center gap-3 text-slate-400 text-sm">
          <ShieldCheck size={18} className="text-green-500" />
          Accès sécurisé réservé aux partenaires
        </div>

        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -translate-x-1/4 translate-y-1/4" />
      </div>

      {/* Côté droit : Formulaire de connexion Pro */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Header Mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-wider text-slate-900">ATTENDS <span className="font-light text-slate-500">PRO</span></span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion Professionnelle</h2>
            <p className="text-sm text-gray-500">Connectez-vous à votre espace de gestion.</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email professionnelle</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all sm:text-sm"
                placeholder="prenom.nom@entreprise.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-medium py-3 mt-2 flex justify-center items-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <span className="flex items-center gap-2">Accéder à mon espace <ArrowRight size={16} /></span>
              )}
            </button>
          </form>

          {/* Boutons démo */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 text-center uppercase tracking-wider font-semibold">Accès Démo Rapide</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => fillDemo('manager')} type="button" className="text-xs py-2 px-3 bg-gray-50 text-gray-600 rounded-md border border-gray-200 hover:bg-gray-100 transition-all font-medium">
                Remplir Manager
              </button>
              <button onClick={() => fillDemo('agent')} type="button" className="text-xs py-2 px-3 bg-gray-50 text-gray-600 rounded-md border border-gray-200 hover:bg-gray-100 transition-all font-medium">
                Remplir Agent
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Vous êtes un client ?{' '}
              <Link href="/auth/login" className="font-semibold text-orange-600 hover:text-orange-500">
                Retour à l'application
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></span></div>}>
      <ProLoginForm />
    </Suspense>
  )
}
