import { getOutboundMessages } from '@/server/actions/admin'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

const PURPOSES: Record<string, string> = {
  RESET_PASSWORD: 'Mot de passe oublié', OTP: 'Code de vérification', WELCOME: 'Bienvenue', TEMP_PASSWORD: 'Identifiants',
  TURN_SOON: 'Bientôt votre tour', APPOINTMENT_CONFIRMED: 'RDV confirmé', APPOINTMENT_NEW: 'Nouveau RDV (équipe)', APPOINTMENT_MISSED: 'RDV manqué', FOLLOW_UP: 'Suivi visiteur', CAMPAIGN: 'Campagne', DIRECT: 'Message de l’établissement', APPOINTMENT_REMINDER: 'Rappel de RDV',
  APPOINTMENT_CANCELLED: 'RDV annulé', INVOICE: 'Facture', ANNOUNCEMENT: 'Annonce'
}
const TONE = { SENT: 'success', FAILED: 'danger', SIMULATED: 'warning', SKIPPED: 'neutral' } as const
const STATUS = { SENT: 'Envoyé', FAILED: 'Échec', SIMULATED: 'Simulé', SKIPPED: 'Non envoyé (quota)' } as const

// Journal des SMS et e-mails. Sans fournisseur branché, les envois sont « simulés » et leur contenu est lisible ici.
export default async function AdminMessagesPage({ searchParams }: { searchParams: { canal?: string } }) {
  const channel = searchParams.canal === 'SMS' || searchParams.canal === 'EMAIL' ? searchParams.canal : undefined
  const rows = await getOutboundMessages(channel)
  if (!rows) return null

  return (
    <Card>
      <CardHeader
        title="Messages envoyés"
        subtitle="100 derniers SMS et e-mails. « Simulé » : aucun fournisseur branché, le message n’est pas parti."
        action={
          <nav className="flex gap-1 text-sm" aria-label="Filtrer par canal">
            {[['', 'Tous'], ['SMS', 'SMS'], ['EMAIL', 'E-mails']].map(([v, l]) => (
              <a key={v} href={v ? `/admin/messages?canal=${v}` : '/admin/messages'} aria-current={(channel ?? '') === v ? 'page' : undefined}
                className={(channel ?? '') === v ? 'rounded-lg bg-gray-900 px-3 py-1.5 font-semibold text-white' : 'rounded-lg px-3 py-1.5 text-ink-muted hover:bg-gray-100'}>{l}</a>
            ))}
          </nav>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Aucun message pour l’instant" />
      ) : (
        <ul className="stagger divide-y divide-surface-line">
          {rows.map(m => (
            <li key={m.id} className="space-y-1 px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[m.status as keyof typeof TONE] ?? 'neutral'}>{STATUS[m.status as keyof typeof STATUS] ?? m.status}</Badge>
                <span className="font-semibold text-ink">{m.channel === 'SMS' ? 'SMS' : 'E-mail'} · {PURPOSES[m.purpose] ?? m.purpose}</span>
                <span className="text-ink-muted">→ {m.to}</span>
                {m.orgName && <span className="text-ink-muted">· {m.orgName}</span>}
                <span className="ml-auto text-xs tabular-nums text-ink-subtle">{new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              {m.subject && <p className="text-ink">{m.subject}</p>}
              {m.body && <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-sunken p-3 font-sans text-xs text-ink">{m.body}</pre>}
              {m.error && <p className="text-xs text-danger">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
