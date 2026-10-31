const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Suppression de toutes les données existantes...')
  await prisma.ticket.deleteMany()
  await prisma.serviceSession.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.promotion.deleteMany()
  await prisma.queue.deleteMany()
  await prisma.service.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Base de données réinitialisée.')

  console.log('Génération des mots de passe hashés...')
  const hashedPassword = await bcrypt.hash('password123', 10)

  console.log('Création de l\'organisation...')
  const org = await prisma.organization.create({
    data: {
      name: 'Polyclinique Sainte-Anne',
      category: 'Santé',
      description: 'L\'excellence médicale au cœur d\'Abidjan.',
      tvMode: 'HYBRID',
      branches: {
        create: {
          name: 'Principal',
          services: {
            create: [
              { name: 'Médecine Générale', avgDurationMin: 15 },
              { name: 'Pédiatrie', avgDurationMin: 20 },
              { name: 'Laboratoire / Prélèvements', avgDurationMin: 10 }
            ]
          },
          queues: {
            create: [
              { name: 'Médecine', prefix: 'M' },
              { name: 'Pédiatrie', prefix: 'P' },
              { name: 'Laboratoire', prefix: 'L' },
            ]
          }
        }
      }
    }
  })
  console.log('✅ Organisation créée : Polyclinique Sainte-Anne')

  console.log('Création des comptes Utilisateurs de Démo...')
  
  // 1. Manager
  const manager = await prisma.user.create({
    data: {
      name: 'Directeur Hôpital',
      email: 'manager@attends.com',
      password: hashedPassword,
      role: 'MANAGER',
    }
  })
  await prisma.organizationMember.create({
    data: { userId: manager.id, organizationId: org.id, role: 'MANAGER' }
  })

  // 2. Agent
  const agent = await prisma.user.create({
    data: {
      name: 'Agent Accueil',
      email: 'agent@attends.com',
      password: hashedPassword,
      role: 'AGENT',
    }
  })
  await prisma.organizationMember.create({
    data: { userId: agent.id, organizationId: org.id, role: 'AGENT' }
  })

  // 3. Client Rapide
  const client = await prisma.user.create({
    data: {
      name: 'Client Démo',
      phone: '+2250000000000',
      password: hashedPassword,
      role: 'CLIENT',
    }
  })
  console.log('✅ Utilisateurs (Manager, Agent, Client) créés.')

  console.log('Création d\'une promotion de démo...')
  await prisma.promotion.create({
    data: {
      title: 'Check-up Santé Complet',
      description: 'Profitez de votre attente pour réserver un bilan sanguin complet.',
      price: '25 000 FCFA',
      isActive: true,
      organizationId: org.id
    }
  })
  console.log('✅ Promotion marketing générée.')

  console.log('🎉 TOUT EST PRÊT POUR LE TEST FINAL !')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
