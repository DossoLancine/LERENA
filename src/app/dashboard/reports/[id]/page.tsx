import { ReportView } from '@/components/reports/report-view'

export default function DashboardReportPage({ params }: { params: { id: string } }) {
  return <ReportView id={params.id} />
}
