import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default organization
  const org1 = await prisma.organization.create({
    data: {
      name: 'Hôpital Mère-Enfant',
      category: 'Santé',
      description: 'Consultations pédiatriques et générales.',
      branches: {
        create: {
          name: 'Principal',
          services: {
            create: [
              { name: 'Pédiatrie', avgDurationMin: 20 },
              { name: 'Urgences', avgDurationMin: 15 },
              { name: 'Maternité', avgDurationMin: 30 }
            ]
          },
          queues: {
            create: [
              { name: 'Pédiatrie Queue', prefix: 'P' },
              { name: 'Urgences Queue', prefix: 'U' },
            ]
          }
        }
      }
    }
  })

  const org2 = await prisma.organization.create({
    data: {
      name: 'Pharmacie de la Paix',
      category: 'Pharmacie',
      description: 'Médicaments et conseils de santé.',
      branches: {
        create: {
          name: 'Principal',
          services: {
            create: [
              { name: 'Ordonnances', avgDurationMin: 10 },
              { name: 'Conseils', avgDurationMin: 15 }
            ]
          },
          queues: {
            create: [
              { name: 'File principale', prefix: 'PH' }
            ]
          }
        }
      }
    }
  })

  console.log('Seed completed!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
