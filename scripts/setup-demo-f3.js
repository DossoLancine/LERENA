require('./lib/not-production').assertNotProduction('scripts/setup-demo-f3.js')
// Données de démonstration du sprint F3 : guichets de l'Hôpital Mère-Enfant et compte d'accueil.
// Idempotent : peut être relancé sans créer de doublons.
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Hôpital Mère-Enfant' }, include: { branches: { include: { services: true } } } })
  if (!org) throw new Error('Hôpital Mère-Enfant introuvable : lancez d’abord prisma/seed-complete.js')
  const branch = org.branches[0]
  const svc = name => branch.services.find(s => s.name.startsWith(name))?.id

  const counters = [
    { name: 'Guichet 1', serviceIds: [svc('Pédiatrie'), svc('Médecine')].filter(Boolean) },
    { name: 'Guichet 2', serviceIds: [] },
    { name: 'Urgences', serviceIds: [svc('Urgences')].filter(Boolean) },
  ]
  for (const c of counters) {
    await prisma.counter.upsert({
      where: { branchId_name: { branchId: branch.id, name: c.name } },
      update: { serviceIds: c.serviceIds, isActive: true },
      create: { branchId: branch.id, name: c.name, serviceIds: c.serviceIds }
    })
    console.log('✅ Guichet :', c.name)
  }

  const password = await bcrypt.hash('password123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'accueil@attends.com' },
    update: { role: 'RECEPTION' },
    create: { email: 'accueil@attends.com', name: 'Mariam Koné (Accueil)', phone: '+2250300000000', password, role: 'RECEPTION' }
  })
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: 'RECEPTION' },
    create: { userId: user.id, organizationId: org.id, role: 'RECEPTION' }
  })
  console.log('✅ Compte accueil : accueil@attends.com (mot de passe de démo habituel)')
}

main().catch(e => { console.error(e.message); process.exit(1) }).finally(() => prisma.$disconnect())
