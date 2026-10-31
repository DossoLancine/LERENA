import { getOrganizations } from '@/server/actions/orgs'
import ExploreView from './_components/explore-view'

// Liste mise en cache 15 s côté serveur : la page s'affiche instantanément, déjà remplie
export const revalidate = 15

export default async function ExplorePage() {
  const orgs = await getOrganizations()
  return <ExploreView initialOrgs={orgs} />
}
