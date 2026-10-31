import { getOrganizationById } from '@/server/actions/orgs'
import { checkIsFavorite } from '@/server/actions/favorites'
import OrgView from './_components/org-view'

export default async function OrgPage({ params }: { params: { id: string } }) {
  const [org, isFavorite] = await Promise.all([
    getOrganizationById(params.id),
    checkIsFavorite(params.id)
  ])
  return <OrgView params={params} initialOrg={org} initialIsFavorite={isFavorite} />
}
