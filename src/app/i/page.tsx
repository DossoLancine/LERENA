import { Link2Off } from 'lucide-react'

// Le secret est retiré de l'adresse dès l'ouverture : recharger la page ramène ici
export default function SetupLinkMissingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-center text-white">
      <Link2Off size={56} className="text-white/50" aria-hidden="true" />
      <h1 className="mt-6 text-2xl font-bold">Rouvrez le lien d’installation</h1>
      <p className="mt-3 max-w-md text-white/70">
        Pour votre sécurité, le lien disparaît de la barre d’adresse dès son ouverture. Rouvrez-le (ou scannez à nouveau le QR code) depuis l’écran du responsable.
      </p>
    </main>
  )
}
