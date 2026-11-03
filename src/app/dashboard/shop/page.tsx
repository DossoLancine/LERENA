import { redirect } from 'next/navigation'
import { getManagerContext } from '@/lib/session'
import { ShopAdmin } from '@/components/shop/shop-admin'

export default async function DashboardShopPage() {
  const ctx = await getManagerContext()
  if (!ctx) redirect('/dashboard')
  return <ShopAdmin canManage={ctx.can('shop.manage')} canSell={ctx.can('shop.sell')} canStats={ctx.can('stats.view')} />
}
