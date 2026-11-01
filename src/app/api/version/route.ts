// Version actuellement en ligne (comparée par les pages ouvertes depuis longtemps)
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ version: process.env.NEXT_PUBLIC_BUILD_ID }, { headers: { 'Cache-Control': 'no-store' } })
}
