import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'

/** Bandeau des espaces d'administration : recommande la double authentification tant qu'elle n'est pas active. */
export async function TwoFactorNotice({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } })
  if (!user || user.twoFactorEnabled) return null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning-ink">
      <p className="flex items-center gap-2 font-medium">
        <ShieldAlert size={18} aria-hidden="true" />
        Protégez ce compte : activez la double authentification. Elle sera obligatoire en production.
      </p>
      <Link href="/account/security" className="rounded-lg bg-white/70 px-3 py-1.5 font-semibold hover:bg-white">Activer</Link>
    </div>
  )
}
