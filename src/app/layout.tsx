import type { Metadata, Viewport } from 'next'
import './globals.css'
import { NextAuthProvider } from '@/components/providers'
import { NavProgress } from '@/components/navigation/nav-progress'
import { ClientNav } from '@/components/navigation/client-nav'
import { ServiceWorkerRegister } from '@/components/pwa/install'

export const metadata: Metadata = {
  title: 'ATTENDS — Ne perdez plus votre temps à attendre',
  description: 'Gérez vos files d\'attente intelligemment. Rejoignez une file, suivez votre position et recevez une notification quand votre tour approche.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ATTENDS',
  },
  // Balise standard demandée par Chrome (la variante « apple- » seule est dépréciée)
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor: '#C2410C',
  width: 'device-width',
  initialScale: 1,
  // Pas de maximumScale : le zoom à deux doigts doit rester possible (malvoyants)
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* Préférences d'affichage (taille du texte, contraste) appliquées avant le premier affichage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('attends_prefs')||'{}');var s={large:'18px',xlarge:'20px'}[p.textSize];if(s)document.documentElement.style.fontSize=s;if(p.highContrast)document.documentElement.classList.add('high-contrast')}catch(e){}`
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased">
        <NavProgress />
        <ServiceWorkerRegister />
        <NextAuthProvider>
          {children}
          <ClientNav />
        </NextAuthProvider>
      </body>
    </html>
  )
}
