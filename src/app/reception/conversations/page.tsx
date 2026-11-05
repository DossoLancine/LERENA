import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Inbox } from '@/components/conversations/inbox'

// Conversations pour l'accueil : réponses des visiteurs, demandes « parler à l'accueil »
export default function ReceptionConversationsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-3 p-4">
      <Link href="/reception" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"><ArrowLeft size={13} /> Accueil</Link>
      <Inbox visitorsPath="/reception/visitors" />
    </main>
  )
}
