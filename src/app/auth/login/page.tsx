'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap, Briefcase, Headphones, User } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import { homeForRole } from '@/lib/constants'
import { getPublicConfig } from '@/server/actions/platform'
import { destinationAfterSignIn, signInWithCredentials, SSO_ERRORS } from '@/lib/sign-in'
import { getSignInMethods } from '@/server/actions/sign-in'
import { CodeSignIn, EmailLinkSignIn, SsoButtons } from '@/components/auth/passwordless'
import { LegalLinks } from '@/components/legal/legal-links'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const justReset = searchParams.get('reset') === '1'
  const ssoError = searchParams.get('error')
  // Méthodes proposées selon les connecteurs branchés : code (par défaut s'il existe), lien e-mail, Google, code PIN
  const [methods, setMethods] = useState<Awaited<ReturnType<typeof getSignInMethods>> | null>(null)
  const [mode, setMode] = useState<'code' | 'email' | 'pin'>('pin')
  useEffect(() => { getSignInMethods().then(m => { setMethods(m); if (m.phoneCode) setMode('code') }).catch(() => null) }, [])
  const afterSignIn = async () => { router.push(callbackUrl || await destinationAfterSignIn(homeForRole as never)); router.refresh() }
  
  const [email, setEmail] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  useEffect(() => { getPublicConfig().then(c => setDemoMode(c.demoMode)).catch(() => {}) }, [])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Double authentification : le champ « code » apparaît quand le serveur le demande
  const [needOtp, setNeedOtp] = useState(false)
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await signInWithCredentials({
        identifier: email.trim(),
        otp: needOtp ? otp.trim() : '',
        password
      })

      if (res?.error === '2FA_REQUIRED') {
        setNeedOtp(true)
        setIsLoading(false)
        return
      }
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

          // Les comptes professionnels arrivent sur leur espace, les clients sur l'exploration
          router.push(!role || role === 'CLIENT' ? '/explore' : homeForRole(role))
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#fde3cc] via-[#fff6ef] via-30% to-white">
      <div className="p-4 flex items-center justify-between">
        <Link href="/" aria-label="Retour à l’accueil" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-black/5">
          <ArrowLeft size={20} />
        </Link>
        <span className="flex items-center gap-1 font-display text-xl font-extrabold text-ink">Lerena <Zap size={17} className="fill-brand text-brand" /></span>
      </div>
      
      <div className="flex-1 px-6 py-6 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className="mb-6">
          <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-tight text-ink">Content de vous revoir</h1>
          <p className="mt-1 text-sm text-ink-muted">{mode === 'code' ? 'Votre numéro, un code reçu par message, et c’est parti.' : mode === 'email' ? 'Un lien de connexion dans votre messagerie.' : 'Votre numéro et votre code PIN, et c’est parti.'}</p>
        </div>

        {/* Compte démo : affiché seulement en mode démo */}
        {demoMode && <div className="mb-5 p-3.5 bg-orange-50/70 border border-orange-100 rounded-2xl">
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
        </div>}

        {justReset && !error && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">Mot de passe modifié : connectez-vous avec le nouveau.</p>}

        {ssoError && !error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{SSO_ERRORS[ssoError] ?? 'La connexion n’a pas abouti : réessayez.'}</p>}

        {methods && (methods.phoneCode || methods.emailLink) && (
          <nav className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-white/80 p-1 text-sm font-semibold ring-1 ring-black/5" aria-label="Méthode de connexion">
            {([['code', 'Code reçu', !!methods.phoneCode], ['email', 'E-mail', !!methods.emailLink], ['pin', 'Code PIN', true]] as const).filter(m => m[2]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setMode(id); setError('') }} aria-pressed={mode === id} className={`rounded-xl px-2 py-2 ${mode === id ? 'bg-ink text-white' : 'text-ink-muted'}`}>{label}</button>
            ))}
          </nav>
        )}

        {mode === 'code' && methods?.phoneCode && <CodeSignIn simulated={methods.phoneCode.simulated} onSignedIn={afterSignIn} />}
        {mode === 'email' && methods?.emailLink && <EmailLinkSignIn simulated={methods.emailLink.simulated} />}

        {mode === 'pin' && error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        {mode === 'pin' && <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
            <PhoneInput id="login-phone"
              value={email} 
              onChange={setEmail}
            />
          </div>
          <div>
            <label htmlFor="login-pin" className="block text-sm font-medium text-gray-700 mb-1">Code PIN</label>
            <input 
              id="login-pin"
              type="password"
              autoComplete="current-password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-lg tracking-widest outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="••••••"
            />
            <Link href="/auth/forgot" className="mt-2 inline-block text-sm font-medium text-orange-700">Code PIN oublié ?</Link>
          </div>
          {needOtp && (
            <div className="animate-rise-in">
              <label htmlFor="login-otp" className="block text-sm font-medium text-gray-700 mb-1">Code de vérification</label>
              <input id="login-otp" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 focus:bg-white text-lg tracking-widest"
                placeholder="123456" />
              <p className="mt-1 text-xs text-gray-500">Code à 6 chiffres de votre application d’authentification, ou un code de secours.</p>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="pressable w-full rounded-2xl bg-gradient-to-br from-[#fb923c] to-brand py-4 mt-6 flex justify-center items-center font-bold text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)] transition-all disabled:opacity-60"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : "Continuer"}
          </button>
        </form>}

        {methods && (methods.google) && (
          <div className="mt-6">
            <p className="mb-3 flex items-center gap-3 text-xs text-ink-subtle"><span className="h-px flex-1 bg-gray-200" />ou<span className="h-px flex-1 bg-gray-200" /></p>
            <SsoButtons google={methods.google} microsoft={false} note="En continuant avec Google, vous acceptez les conditions d’utilisation et la politique de confidentialité." />
          </div>
        )}

        <p className="text-center mt-8 text-sm text-gray-500">
          Nouveau sur Lerena ?{' '}
          <Link href="/auth/register" className="font-bold text-orange-700">Créer un compte</Link>
        </p>
        <LegalLinks className="mt-4" />

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
