import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Clock, ArrowRight } from "lucide-react"

export default async function LandingPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Background abstract shape */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 max-w-md mx-auto w-full">
        
        {/* Logo */}
        <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/30">
          <Clock size={40} className="text-white" />
        </div>

        <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
          Votre temps<br />
          est <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">précieux.</span>
        </h1>
        
        <p className="text-gray-400 text-lg mb-12 leading-relaxed">
          Rejoignez les files d'attente à distance. Arrivez exactement quand c'est votre tour.
        </p>

        <div className="w-full space-y-4">
          <Link href="/auth/register" className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-2xl text-lg hover:bg-gray-100 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            Créer un compte <ArrowRight size={20} />
          </Link>
          <Link href="/auth/login" className="w-full flex items-center justify-center gap-2 bg-white/10 text-white font-bold py-4 rounded-2xl text-lg hover:bg-white/20 transition-all border border-white/10">
            Se connecter
          </Link>
        </div>

        <div className="mt-12 text-gray-500 text-sm">
          Vous êtes un professionnel ?{' '}
          <Link href="/pro/login" className="text-orange-500 font-semibold hover:underline">
            Espace Entreprise
          </Link>
        </div>

      </div>
    </div>
  )
}
