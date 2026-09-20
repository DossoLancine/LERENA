const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Activation du Geofencing sur les établissements...')
  
  await prisma.organization.updateMany({
    data: {
      requireGps: true,
      maxRadiusKm: 5.0 // On met 5 km pour tester le hors limite !
    }
  })
  
  console.log('✅ Geofencing activé avec succès (5 km) !')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
