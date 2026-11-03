import { prisma } from '@/lib/prisma'

// Photo d'un produit de la boutique servie comme une image (mise en cache) ; l'adresse change à chaque modification (?v=).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await prisma.shopProduct.findUnique({ where: { id: params.id }, select: { imageUrl: true } })
  const match = p?.imageUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/)
  if (!match) return new Response(null, { status: 404 })
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: { 'Content-Type': match[1], 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', 'X-Content-Type-Options': 'nosniff' }
  })
}
