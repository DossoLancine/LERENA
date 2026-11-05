import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { homeForRole } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// Retour de Google ou Microsoft : chacun arrive sur son espace
export default async function ContinuePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  redirect(user.role === 'CLIENT' ? '/explore' : homeForRole(user.role))
}
