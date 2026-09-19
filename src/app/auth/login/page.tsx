'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Zap, Briefcase, Headphones, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
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
        email: email.trim(),
        password
      })

      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Email ou mot de passe incorrect' : res.error)
        setIsLoading(false)
        return
      }

      if (res?.ok) {
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

        {/* Comptes Démo Rapides */}
        <div className="mb-5 p-3.5 bg-orange-50/70 border border-orange-100 rounded-2xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800 mb-2 uppercase tracking-wider">
            <Zap size={14} className="text-orange-500" />
            <span>Remplissage rapide démo :</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('manager@attends.com')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white rounded-xl border border-orange-200 text-xs font-semibold text-gray-800 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
            >
              <Briefcase size={14} />
              <span>Manager</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('agent@attends.com')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white rounded-xl border border-orange-200 text-xs font-semibold text-gray-800 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
            >
              <Headphones size={14} />
              <span>Agent</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('client@attends.com')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white rounded-xl border border-orange-200 text-xs font-semibold text-gray-800 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
            >
              <User size={14} />
              <span>Client</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all"
              placeholder="votre@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <div className="text-right">
            <Link href="#" className="text-sm text-orange-500 font-medium">Mot de passe oublié ?</Link>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-primary py-3.5 mt-2 flex justify-center items-center"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : "Se connecter"}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500">
          Pas encore de compte ?{' '}
          <Link href="/auth/register" className="font-semibold text-orange-500">S&apos;inscrire</Link>
        </p>
      </div>
    </div>
  )
}
