const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Initialisation des donnees de test sur Supabase...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  let org = await prisma.organization.findFirst({
    where: { name: 'Hopital Mere-Enfant' },
    include: { branches: { include: { services: true, queues: true } } }
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Hopital Mere-Enfant',
        category: 'Sante',
        description: 'Consultations pediatriques, urgences et medecine generale.',
        address: 'Boulevard de la Republique, Plateau',
        city: 'Abidjan',
        phone: '+225 27 20 00 00 00',
        email: 'contact@mere-enfant.ci',
        tvMode: 'HYBRID',
        tvQueueDuration: 30,
        tvVideoDuration: 30,
        tvVideoUrl: JSON.stringify([
          {
            id: 'v1',
            title: 'Presentation de la Clinique & Soins',
            url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4'
          }
        ]),
        branches: {
          create: {
            name: 'Siege Principal',
            address: 'Plateau, Rez-de-chaussee',
            services: {
              create: [
                { name: 'Pediatrie & Vaccinations', avgDurationMin: 15 },
                { name: 'Medecine Generale', avgDurationMin: 20 },
                { name: 'Urgences & Soins Rapides', avgDurationMin: 10 }
              ]
            },
            queues: {
              create: [
                { name: 'File Pediatrie', prefix: 'P' },
                { name: 'File Generale', prefix: 'A' },
                { name: 'File Urgences', prefix: 'U' }
              ]
            }
          }
        },
        promotions: {
          create: [
            {
              title: 'Bilan de Sante Pediatrique Complet',
              description: 'Examen general + depistage visuel et auditif pour les enfants de 0 a 12 ans.',
              price: '15 000 FCFA',
              imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
              isActive: true
            },
            {
              title: 'Campagne de Vaccination 2026',
              description: 'Protegez vos proches avec notre forfait immunite saisonniere.',
              price: 'Gratuit',
              imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&q=80',
              isActive: true
            }
          ]
        }
      },
      include: { branches: { include: { services: true, queues: true } } }
    });
    console.log('Organisation Hopital Mere-Enfant creee sur Supabase.');
  }

  const manager = await prisma.user.upsert({
    where: { email: 'manager@attends.com' },
    update: { password: hashedPassword, role: 'MANAGER' },
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

  const agent = await prisma.user.upsert({
    where: { email: 'agent@attends.com' },
    update: { password: hashedPassword, role: 'AGENT' },
    create: {
      email: 'agent@attends.com',
      password: hashedPassword,
      name: 'Awa Traore (Guichetier 1)',
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

  const client = await prisma.user.upsert({
    where: { email: 'client@attends.com' },
    update: { password: hashedPassword, role: 'CLIENT' },
    create: {
      email: 'client@attends.com',
      password: hashedPassword,
      name: 'Jean Kouassi (Patient)',
      role: 'CLIENT',
      phone: '+225 01 99 88 77 66'
    }
  });

  console.log('Utilisateurs crees avec succes sur Supabase :');
  console.log('1. Manager: manager@attends.com / password123');
  console.log('2. Agent:   agent@attends.com / password123');
  console.log('3. Client:  client@attends.com / password123');
  console.log('Organisation ID: ' + org.id);
  console.log('URL TV: /tv/' + org.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
