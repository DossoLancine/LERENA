import { getProducts } from '@/server/actions/billing-admin'
import { CatalogView } from './catalog-view'

export const dynamic = 'force-dynamic'

export default async function AdminCatalogPage() {
  const products = await getProducts()
  if (!products) return null
  return <CatalogView products={products} />
}
