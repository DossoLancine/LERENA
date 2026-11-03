import { Suspense } from 'react'
import { VisitorsList } from '@/components/crm/visitors-list'

export default function ReceptionVisitorsPage() {
  return <Suspense><VisitorsList basePath="/reception/visitors" /></Suspense>
}
