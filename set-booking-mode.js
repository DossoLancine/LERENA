const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // List all orgs
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, bookingMode: true } })
  console.log('Organizations:', JSON.stringify(orgs, null, 2))
  
  // Set the first 2 orgs to HYBRID mode so the feature is visible
  if (orgs.length > 0) {
    await prisma.organization.update({ where: { id: orgs[0].id }, data: { bookingMode: 'HYBRID' } })
    console.log(`✅ "${orgs[0].name}" → HYBRID`)
  }
  if (orgs.length > 1) {
    await prisma.organization.update({ where: { id: orgs[1].id }, data: { bookingMode: 'APPOINTMENT_ONLY' } })
    console.log(`✅ "${orgs[1].name}" → APPOINTMENT_ONLY`)
  }
  
  await prisma.$disconnect()
  console.log('Done!')
}

main().catch(e => { console.error(e); process.exit(1) })
