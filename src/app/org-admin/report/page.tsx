import { getNetworkMonthlyReport } from '@/server/actions/network'
import { ReportView } from '../_components/report-view'

export const dynamic = 'force-dynamic'

export default async function NetworkReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const report = await getNetworkMonthlyReport(searchParams.month)
  if (!report) return null
  return <ReportView report={report} />
}
