// Remplit une base de TEST (staging) avec les données de démonstration : établissements, services,
// guichets, comptes de démo (mot de passe connu), réseau et administration. Refuse la production.
//
//   DATABASE_URL=… DIRECT_URL=… node scripts/seed-staging.js
require('./lib/not-production').assertNotProduction('scripts/seed-staging.js')
const { execFileSync } = require('child_process')
const path = require('path')

const steps = [
  ['prisma/seed-complete.js', 'Hôpital, services, files et comptes de démo'],
  ['scripts/create-demo-orgs.js', 'Autres établissements de démonstration'],
  ['scripts/setup-demo-f3.js', 'Guichets et compte d’accueil'],
  ['scripts/setup-demo-f6.js', 'Réseau, lecteur et administrateur plateforme']
]

for (const [file, label] of steps) {
  console.log(`\n▶ ${label} (${file})`)
  execFileSync(process.execPath, [path.join(process.cwd(), file)], { stdio: 'inherit', env: process.env })
}

// Boutons « Accès démo » visibles sur la base de test
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.platformConfig
  .upsert({ where: { id: 'default' }, update: { demoMode: true }, create: { id: 'default', demoMode: true } })
  .then(() => console.log('\n✅ Base de test prête (mode démo activé)'))
  .finally(() => prisma.$disconnect())
