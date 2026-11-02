// Identifiant de la version mise en ligne : les écrans restés ouverts le comparent pour se recharger
const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())

// En-têtes de sécurité appliqués à toutes les pages
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://router.project-osrm.org https://*.tile.openstreetmap.org",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Caméra : scan du QR code ; position : distance et anti-abus ; le reste est fermé
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()' },
  // Politique de contenu d'abord en observation : elle signale sans bloquer, le temps de vérifier qu'elle ne casse rien
  { key: 'Content-Security-Policy-Report-Only', value: CSP }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Redirection au niveau du serveur : une redirection dans une page fait planter le routeur de Next 14.2
  // lors d'une navigation côté navigateur
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  async redirects() {
    return [{ source: '/dashboard/settings', destination: '/dashboard/settings/site', permanent: false }]
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Démarrage du serveur : journal d'erreurs intégré (src/instrumentation.ts)
    instrumentationHook: true,
    // Cache de navigation côté navigateur : revenir sur une page déjà vue est instantané.
    // Les écrans en direct (ticket, agent, TV) se mettent à jour via le temps réel.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // Charge seulement les icônes utilisées au lieu de toute la bibliothèque
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
}

module.exports = nextConfig
