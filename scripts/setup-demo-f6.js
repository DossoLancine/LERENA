require('./lib/not-production').assertNotProduction('scripts/setup-demo-f6.js')
// Données de démonstration du sprint F6 : un réseau de santé, son administrateur, un lecteur,
// et le compte d'administration de la plateforme.
// Idempotent : peut être relancé sans créer de doublons.
// Le compte plateforme reçoit un mot de passe aléatoire affiché une seule fois (jamais le mot de passe de démo).
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { randomInt } = require('crypto')
const prisma = new PrismaClient()

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
const randomPassword = (n = 14) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

async function networkAccount(networkId, email, name, role, password) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, name, role, password: await bcrypt.hash(password, 10) }
  })
  await prisma.networkMember.upsert({
    where: { userId_networkId: { userId: user.id, networkId } },
    update: { role },
    create: { userId: user.id, networkId, role }
  })
  console.log(`✅ ${role} : ${email}`)
}

async function main() {
  let network = await prisma.network.findFirst({ where: { name: 'Réseau Santé Abidjan' } })
  if (!network) network = await prisma.network.create({ data: { name: 'Réseau Santé Abidjan', sector: 'Santé' } })
  console.log('✅ Réseau :', network.name)

  const res = await prisma.organization.updateMany({
    where: { sector: { slug: 'sante' }, networkId: null },
    data: { networkId: network.id }
  })
  console.log(`✅ ${res.count} établissement(s) de santé rattaché(s) au réseau`)

  await networkAccount(network.id, 'reseau@attends.com', 'Awa Traoré (Réseau)', 'ORG_ADMIN', 'password123')
  await networkAccount(network.id, 'lecteur@attends.com', 'Direction régionale (lecture)', 'VIEWER', 'password123')

  const admin = await prisma.user.findUnique({ where: { email: 'admin@attends.com' } })
  if (admin) {
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'SUPER_ADMIN' } })
    console.log('✅ SUPER_ADMIN : admin@attends.com (existant, mot de passe inchangé)')
  } else {
    const password = randomPassword()
    await prisma.user.create({ data: { email: 'admin@attends.com', name: 'Équipe ATTENDS', role: 'SUPER_ADMIN', password: await bcrypt.hash(password, 10) } })
    console.log(`✅ SUPER_ADMIN : admin@attends.com — mot de passe (à conserver, affiché une seule fois) : ${password}`)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) }).finally(() => prisma.$disconnect())
