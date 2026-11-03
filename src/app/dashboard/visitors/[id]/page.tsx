import { VisitorFile } from '@/components/crm/visitor-file'

export default function DashboardVisitorPage({ params }: { params: { id: string } }) {
  return <VisitorFile id={params.id} basePath="/dashboard/visitors" />
}
