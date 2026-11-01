import { getOrganizations } from '@/server/actions/orgs'
import { getActiveSectors, getPlatformConfig } from '@/lib/platform'
import ExploreView from './_components/explore-view'

// Liste mise en cache 15 s côté serveur : la page s'affiche instantanément, déjà remplie
export const revalidate = 15

export default async function ExplorePage() {
  const [orgs, sectors, config] = await Promise.all([getOrganizations(), getActiveSectors(), getPlatformConfig()])
  const center: [number, number] | null = config.defaultLat != null && config.defaultLng != null ? [config.defaultLat, config.defaultLng] : null
  // Seuls les secteurs qui ont au moins un établissement deviennent des filtres
  const used = new Set(orgs.map(o => o.sectorSlug))
  return <ExploreView initialOrgs={orgs} defaultCenter={center} sectors={sectors.filter(s => used.has(s.slug)).map(s => ({ slug: s.slug, name: s.name }))} />
}
