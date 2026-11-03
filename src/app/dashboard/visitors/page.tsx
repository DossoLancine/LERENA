import { Suspense } from 'react'
import { VisitorsList } from '@/components/crm/visitors-list'

export default function DashboardVisitorsPage() {
  return <Suspense><VisitorsList basePath="/dashboard/visitors" /></Suspense>
}
