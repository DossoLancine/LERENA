import { notFound } from 'next/navigation'
import { getClient } from '@/server/actions/billing-admin'
import { ClientFile } from './client-file'

export const dynamic = 'force-dynamic'

export default async function AdminClientPage({ params }: { params: { id: string } }) {
  const data = await getClient(params.id)
  if (!data) notFound()
  return <ClientFile data={data} />
}
