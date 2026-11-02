import { prisma } from '@/lib/prisma'

// Sonde de disponibilité pour un service de surveillance externe (UptimeRobot, Better Stack…) :
// 200 si l'application et la base répondent, 503 sinon. Aucune donnée sensible.
export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const job = await prisma.jobRun.findUnique({ where: { id: 'appointments' }, select: { lastRunAt: true } })
    return Response.json({
      status: 'ok',
      database: { ok: true, latencyMs: Date.now() - t0 },
      jobs: { lastRunAt: job?.lastRunAt.toISOString() ?? null },
      version: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
      time: new Date().toISOString()
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'down', database: { ok: false } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
