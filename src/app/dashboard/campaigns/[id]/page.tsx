import { CampaignDetail } from '@/components/crm/campaigns'

export default function CampaignPage({ params }: { params: { id: string } }) {
  return <CampaignDetail id={params.id} />
}
