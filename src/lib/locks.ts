import { prisma } from '@/lib/prisma'

// Verrou « une seule fois » (alerte de l'heure, rapport du jour, revue du mois…) : une ligne JobRun par clé.
// Insertion qui ignore les doublons : pas d'erreur de contrainte unique, donc rien dans le journal des incidents.

export async function claimOnce(id: string, now = new Date()) {
  const res = await prisma.jobRun.createMany({ data: [{ id, lastRunAt: now }], skipDuplicates: true })
  return res.count === 1
}
