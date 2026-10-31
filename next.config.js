/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
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
