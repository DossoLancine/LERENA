import { notFound } from 'next/navigation'
import { getPilotReport } from '@/server/actions/pilot'
import { PilotView } from './pilot-view'

export const dynamic = 'force-dynamic'

export default async function PilotPage({ params }: { params: { id: string } }) {
  const data = await getPilotReport(params.id)
  if (!data) notFound()
  return <PilotView data={data} />
}
