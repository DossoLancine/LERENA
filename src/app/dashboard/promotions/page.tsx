import { redirect } from 'next/navigation'

// Les promotions font désormais partie de la boutique
export default function DashboardPromotionsPage() {
  redirect('/dashboard/shop')
}
