const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding example users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Get first organization
  const org = await prisma.organization.findFirst({
    include: { branches: true }
  });

  if (!org) {
    console.error('No organization found! Please make sure an organization exists.');
    return;
  }

  // 2. Create MANAGER user
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

  // Link manager to org
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
  console.log('✅ Manager created: manager@attends.com / password123 (Rôle: MANAGER)');

  // 3. Create AGENT user
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

  // Link agent to org
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
  console.log('✅ Agent created: agent@attends.com / password123 (Rôle: AGENT)');

  // 4. Create CLIENT user
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
  console.log('✅ Client created: client@attends.com / password123 (Rôle: CLIENT)');

  console.log('\n--- RÉCAPITULATIF DES UTILISATEURS ---');
  console.log('1. MANAGER  -> Email: manager@attends.com | Pass: password123 | Accès: /dashboard');
  console.log('2. AGENT    -> Email: agent@attends.com   | Pass: password123 | Accès: /agent');
  console.log('3. CLIENT   -> Email: client@attends.com  | Pass: password123 | Accès: /explore, /ticket, /profile');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
