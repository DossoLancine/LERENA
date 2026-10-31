const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Mise à jour des coordonnées GPS des établissements...')
  
  const orgs = await prisma.organization.findMany()
  
  // Abidjan base coordinates (Plateau)
  const baseLat = 5.320357
  const baseLng = -4.016107

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    // Add a small random offset for each org so they aren't exactly on top of each other
    // ~ 1-5 km apart
    const latOffset = (Math.random() - 0.5) * 0.05
    const lngOffset = (Math.random() - 0.5) * 0.05
    
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset,
      }
    })
    console.log(`✅ Mise à jour : ${org.name} -> ${baseLat + latOffset}, ${baseLng + lngOffset}`)
  }
  
  console.log('🎉 Terminé !')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
