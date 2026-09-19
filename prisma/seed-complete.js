const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Réinitialisation et enregistrement complet des utilisateurs de test sur Supabase...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Récupérer ou créer l'organisation
  let org = await prisma.organization.findFirst({
    where: { name: 'Hôpital Mère-Enfant' },
    include: {
      branches: {
        include: {
          services: true,
          queues: true
        }
      }
    }
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Hôpital Mère-Enfant',
        category: 'Santé',
        description: 'Consultations pédiatriques, urgences et médecine générale.',
        address: 'Boulevard de la République, Plateau',
        city: 'Abidjan',
        phone: '+225 27 20 00 00 00',
        email: 'contact@mere-enfant.ci',
        tvMode: 'HYBRID',
        tvQueueDuration: 30,
        tvVideoDuration: 30,
        tvVideoUrl: JSON.stringify([
          {
            id: 'v1',
            title: 'Présentation de la Clinique & Soins',
            url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4'
          }
        ]),
        branches: {
          create: {
            name: 'Siège Principal',
            address: 'Plateau, Rez-de-chaussée',
            services: {
              create: [
                { name: 'Pédiatrie & Vaccinations', avgDurationMin: 15 },
                { name: 'Médecine Générale', avgDurationMin: 20 },
                { name: 'Urgences & Soins Rapides', avgDurationMin: 10 }
              ]
            },
            queues: {
              create: [
                { name: 'File Pédiatrie', prefix: 'P' },
                { name: 'File Générale', prefix: 'A' },
                { name: 'File Urgences', prefix: 'U' }
              ]
            }
          }
        },
        promotions: {
          create: [
            {
              title: 'Bilan de Santé Pédiatrique Complet',
              description: 'Examen général + dépistage visuel et auditif pour les enfants de 0 à 12 ans.',
              price: '15 000 FCFA',
              imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
              isActive: true
            },
            {
              title: 'Campagne de Vaccination 2026',
              description: 'Protégez vos proches avec notre forfait immunité saisonnière.',
              price: 'Gratuit',
              imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&q=80',
              isActive: true
            }
          ]
        }
      },
      include: {
        branches: {
          include: {
            services: true,
            queues: true
          }
        }
      }
    });
    console.log('✅ Organisation Hôpital Mère-Enfant créée.');
  } else {
    console.log('ℹ️ Organisation existante trouvée :', org.name);
  }

  const branch = org.branches[0];
  const servicePediatrie = branch.services.find(s => s.name.includes('Pédiatrie')) || branch.services[0];
  const queuePediatrie = branch.queues.find(q => q.prefix === 'P') || branch.queues[0];

  // 2. Utilisateur 1 : MANAGER
  const manager = await prisma.user.upsert({
    where: { email: 'manager@attends.com' },
    update: {
      password: hashedPassword,
      role: 'MANAGER',
      name: 'Dr. Koffi (Directeur)'
    },
    create: {
      email: 'manager@attends.com',
      password: hashedPassword,
      name: 'Dr. Koffi (Directeur)',
      role: 'MANAGER',
      phone: '+225 07 01 02 03 04'
    }
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: manager.id,
        organizationId: org.id
      }
    },
    update: { role: 'MANAGER' },
    create: {
      userId: manager.id,
      organizationId: org.id,
      role: 'MANAGER'
    }
  });
  console.log('✅ [1/3] MANAGER enregistré : manager@attends.com (MDP: password123)');

  // 3. Utilisateur 2 : AGENT (Guichetier)
  const agent = await prisma.user.upsert({
    where: { email: 'agent@attends.com' },
    update: {
      password: hashedPassword,
      role: 'AGENT',
      name: 'Awa Traoré (Guichetier 1)'
    },
    create: {
      email: 'agent@attends.com',
      password: hashedPassword,
      name: 'Awa Traoré (Guichetier 1)',
      role: 'AGENT',
      phone: '+225 05 11 22 33 44'
    }
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: agent.id,
        organizationId: org.id
      }
    },
    update: { role: 'AGENT' },
    create: {
      userId: agent.id,
      organizationId: org.id,
      role: 'AGENT'
    }
  });
  console.log('✅ [2/3] AGENT enregistré : agent@attends.com (MDP: password123)');

  // 4. Utilisateur 3 : CLIENT (Patient)
  const client = await prisma.user.upsert({
    where: { email: 'client@attends.com' },
    update: {
      password: hashedPassword,
      role: 'CLIENT',
      name: 'Jean Kouassi (Patient)'
    },
    create: {
      email: 'client@attends.com',
      password: hashedPassword,
      name: 'Jean Kouassi (Patient)',
      role: 'CLIENT',
      phone: '+225 01 99 88 77 66'
    }
  });
  console.log('✅ [3/3] CLIENT enregistré : client@attends.com (MDP: password123)');

  // 5. Créer des tickets d'exemple pour tester immédiatement
  const existingTickets = await prisma.ticket.count({
    where: { queueId: queuePediatrie.id }
  });

  if (existingTickets === 0) {
    // Ticket 1 : EN SERVICE (actuellement au guichet)
    await prisma.ticket.create({
      data: {
        queueId: queuePediatrie.id,
        serviceId: servicePediatrie.id,
        userId: client.id,
        guestName: 'Jean Kouassi',
        number: 1,
        displayNum: 'P001',
        status: 'SERVING',
        position: 0,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
        calledAt: new Date(Date.now() - 5 * 60 * 1000),
        startedAt: new Date(Date.now() - 4 * 60 * 1000)
      }
    });

    // Ticket 2 : EN ATTENTE (prochain à passer)
    await prisma.ticket.create({
      data: {
        queueId: queuePediatrie.id,
        serviceId: servicePediatrie.id,
        guestName: 'Fatou Bamba',
        guestPhone: '+225 07 44 55 66 77',
        number: 2,
        displayNum: 'P002',
        status: 'WAITING',
        position: 1,
        createdAt: new Date(Date.now() - 10 * 60 * 1000)
      }
    });

    // Ticket 3 : EN ATTENTE
    await prisma.ticket.create({
      data: {
        queueId: queuePediatrie.id,
        serviceId: servicePediatrie.id,
        guestName: 'Mohamed Sylla',
        guestPhone: '+225 05 88 99 00 11',
        number: 3,
        displayNum: 'P003',
        status: 'WAITING',
        position: 2,
        createdAt: new Date(Date.now() - 5 * 60 * 1000)
      }
    });
    console.log('✅ 3 tickets démo créés (P001 En service, P002 En attente, P003 En attente)');
  } else {
    console.log(`ℹ️ ${existingTickets} tickets déjà présents dans la file.`);
  }

  console.log('\n======================================================');
  console.log('🎉 ENREGISTREMENT TERMINÉ AVEC SUCCÈS SUR SUPABASE !');
  console.log('======================================================');
  console.log('1. MANAGER : manager@attends.com  | MDP: password123');
  console.log('2. AGENT   : agent@attends.com    | MDP: password123');
  console.log('3. CLIENT  : client@attends.com   | MDP: password123');
  console.log('Organisation ID :', org.id);
  console.log('Écran TV Horizon 2050 : /tv/' + org.id);
  console.log('======================================================\n');
}

main()
  .catch(e => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
