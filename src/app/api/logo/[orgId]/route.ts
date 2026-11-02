import { prisma } from '@/lib/prisma'

// Logo d'un établissement servi comme une image (mise en cache) : les listes n'embarquent pas les images
// dans leurs données. L'adresse change à chaque modification du logo (?v=), le cache peut donc être long.
export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  const org = await prisma.organization.findUnique({ where: { id: params.orgId }, select: { logo: true } })
  const match = org?.logo?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/)
  if (!match) return new Response(null, { status: 404 })
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: { 'Content-Type': match[1], 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' }
  })
}
