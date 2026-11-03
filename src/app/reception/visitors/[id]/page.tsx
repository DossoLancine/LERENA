import { VisitorFile } from '@/components/crm/visitor-file'

export default function ReceptionVisitorPage({ params }: { params: { id: string } }) {
  return <VisitorFile id={params.id} basePath="/reception/visitors" />
}
