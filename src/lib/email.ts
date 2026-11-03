import nodemailer from 'nodemailer'
import { getIntegration, type ResolvedIntegration } from '@/lib/integrations'

// Envoi d'e-mails par le connecteur « E-mail » de la console : messagerie du domaine (SMTP) ou Resend.
// Les anciennes variables (RESEND_API_KEY, EMAIL_FROM, SMTP_*) restent reconnues tant que la console n'est pas réglée.

export interface EmailContent {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}

let transport: { key: string; value: nodemailer.Transporter } | null = null

function smtpTransport(v: Record<string, string>) {
  const key = `${v.host}:${v.port}:${v.user}:${v.password}`
  if (transport?.key === key) return transport.value
  const port = Number(v.port) || 587
  const value = nodemailer.createTransport({ host: v.host, port, secure: port === 465, auth: { user: v.user, pass: v.password } })
  transport = { key, value }
  return value
}

/** Envoie un e-mail ; lève une erreur détaillée en cas d'échec. Renvoie le prestataire utilisé. */
export async function deliverEmail(mail: EmailContent, config?: ResolvedIntegration) {
  const c = config ?? await getIntegration('EMAIL')
  if (!c.live) throw new Error('Connecteur e-mail en simulation')
  if (c.provider === 'smtp') {
    await smtpTransport(c.values).sendMail({ from: c.values.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, attachments: mail.attachments })
    return 'smtp'
  }
  if (c.provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.values.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: c.values.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html,
        attachments: mail.attachments?.map(a => ({ filename: a.filename, content: a.content.toString('base64') }))
      })
    })
    if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 200)}`)
    return 'resend'
  }
  throw new Error(`Fournisseur e-mail inconnu : ${c.provider}`)
}
