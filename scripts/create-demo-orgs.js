const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const baseLat = 5.320357
  const baseLng = -4.016107

  const orgsData = [
    {
      name: "Polyclinique Sainte-Anne",
      category: "Santé",
      isActive: true, // Ouvert
      lat: baseLat + 0.005,
      lng: baseLng - 0.002,
      requireGps: true,
      maxRadiusKm: 10,
    },
    {
      name: "Pharmacie Lagune",
      category: "Pharmacie",
      isActive: true, // Ouvert
      lat: baseLat - 0.015,
      lng: baseLng + 0.005,
      requireGps: true,
      maxRadiusKm: 5,
    },
    {
      name: "Agence SGBCI Plateau",
      category: "Banque",
      isActive: true, // Ouvert
      lat: baseLat + 0.002,
      lng: baseLng - 0.008,
      requireGps: true,
      maxRadiusKm: 15,
    },
    {
      name: "Burger King Marcory",
      category: "Restauration",
      isActive: false, // Fermé
      lat: baseLat - 0.025,
      lng: baseLng + 0.015,
      requireGps: false,
      maxRadiusKm: 5,
    },
    {
      name: "Institut Beauté Divine",
      category: "Beauté",
      isActive: false, // Fermé
      lat: baseLat + 0.035,
      lng: baseLng - 0.010,
      requireGps: false,
      maxRadiusKm: 5,
    }
  ]

  console.log('Création de 5 nouveaux établissements (3 ouverts, 2 fermés)...')

  for (const orgData of orgsData) {
    const org = await prisma.organization.create({
      data: {
        name: orgData.name,
        category: orgData.category,
        isActive: orgData.isActive,
        lat: orgData.lat,
        lng: orgData.lng,
        requireGps: orgData.requireGps,
        maxRadiusKm: orgData.maxRadiusKm,
        // On crée la structure minimale (Branch > Service + Queue) pour que l'UI fonctionne
        branches: {
          create: [
            {
              name: "Siège Principal",
              queues: {
                create: [
                  {
                    name: "File d'attente",
                    prefix: "A",
                    currentNum: Math.floor(Math.random() * 4) + 1 // Génère une attente aléatoire
                  }
                ]
              },
              services: {
                create: [
                  {
                    name: "Service Client",
                    avgDurationMin: 15
                  }
                ]
              }
            }
          ]
        }
      }
    })
    console.log(`✅ Créé : ${org.name} (${org.isActive ? '🟢 Ouvert' : '🔴 Fermé'})`)
  }

  console.log('🎉 Terminé avec succès !')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
