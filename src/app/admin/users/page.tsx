import { searchUsers } from '@/server/actions/billing-admin'
import { UsersView } from './users-view'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const users = await searchUsers(searchParams.q ?? '')
  if (!users) return null
  return <UsersView users={users} q={searchParams.q ?? ''} />
}
