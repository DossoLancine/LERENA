// Catalogue des connecteurs vers les services extérieurs : prestataires et champs à remplir dans la console.
// Sans accès à la base ni aux secrets : utilisé par la console (affichage) et par le serveur (validation).

export type IntegrationKind = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'AI' | 'PAYMENT' | 'AUTH'
export type IntegrationMode = 'SIMULATION' | 'LIVE'

export interface IntegrationField {
  key: string
  label: string
  secret?: boolean
  required?: boolean
  placeholder?: string
  hint?: string
}

export interface IntegrationProvider {
  id: string
  label: string
  fields: IntegrationField[]
  /** Ce que le test fait réellement en production. */
  testHint: string
}

export interface IntegrationDefinition {
  kind: IntegrationKind
  label: string
  description: string
  /** Ce qui se passe tant que le connecteur reste en simulation. */
  simulation: string
  /** Destinataire demandé pour le test (adresse, numéro…), ou rien. */
  testTarget?: { label: string; placeholder: string; type: 'email' | 'phone' }
  providers: IntegrationProvider[]
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    kind: 'EMAIL',
    label: 'E-mail',
    description: 'Rapports, alertes, identifiants, factures et confirmations par e-mail.',
    simulation: 'Les e-mails sont enregistrés dans le journal des messages, rien ne part.',
    testTarget: { label: 'Envoyer un e-mail de test à', placeholder: 'vous@exemple.ci', type: 'email' },
    providers: [
      {
        id: 'smtp', label: 'Messagerie du domaine (SMTP)', testHint: 'Envoie un e-mail de test à l’adresse indiquée.',
        fields: [
          { key: 'host', label: 'Serveur SMTP', required: true, placeholder: 'smtp.exemple.ci' },
          { key: 'port', label: 'Port', required: true, placeholder: '587', hint: '587 (STARTTLS) ou 465 (SSL)' },
          { key: 'user', label: 'Identifiant', required: true, placeholder: 'rapports@lerena.ci' },
          { key: 'password', label: 'Mot de passe', secret: true, required: true },
          { key: 'from', label: 'Expéditeur affiché', required: true, placeholder: 'Lerena <rapports@lerena.ci>' }
        ]
      },
      {
        id: 'resend', label: 'Resend', testHint: 'Envoie un e-mail de test à l’adresse indiquée.',
        fields: [
          { key: 'apiKey', label: 'Clé API', secret: true, required: true, placeholder: 're_…' },
          { key: 'from', label: 'Expéditeur affiché', required: true, placeholder: 'Lerena <rapports@lerena.ci>', hint: 'Domaine vérifié dans Resend' }
        ]
      }
    ]
  },
  {
    kind: 'SMS',
    label: 'SMS',
    description: 'Rappels, codes de vérification, suivis, campagnes et réponses aux avis.',
    simulation: 'Les SMS sont enregistrés dans le journal et décomptés des quotas, rien ne part.',
    testTarget: { label: 'Envoyer un SMS de test au', placeholder: '+225 07 00 00 00 00', type: 'phone' },
    providers: [
      {
        id: 'orange', label: 'Orange SMS API (Côte d’Ivoire)', testHint: 'Envoie un SMS de test au numéro indiqué.',
        fields: [
          { key: 'clientId', label: 'Client ID', required: true },
          { key: 'clientSecret', label: 'Client secret', secret: true, required: true },
          { key: 'senderPhone', label: 'Numéro d’envoi', required: true, placeholder: '2250700000000' },
          { key: 'senderName', label: 'Nom d’expéditeur', placeholder: 'LERENA', hint: 'Validé par Orange' }
        ]
      },
      {
        id: 'infobip', label: 'Infobip', testHint: 'Envoie un SMS de test au numéro indiqué.',
        fields: [
          { key: 'baseUrl', label: 'Adresse de l’API', required: true, placeholder: 'https://xxxxx.api.infobip.com' },
          { key: 'apiKey', label: 'Clé API', secret: true, required: true },
          { key: 'sender', label: 'Nom d’expéditeur', required: true, placeholder: 'LERENA' }
        ]
      },
      {
        id: 'twilio', label: 'Twilio', testHint: 'Envoie un SMS de test au numéro indiqué.',
        fields: [
          { key: 'accountSid', label: 'Account SID', required: true, placeholder: 'AC…' },
          { key: 'authToken', label: 'Auth token', secret: true, required: true },
          { key: 'from', label: 'Expéditeur', required: true, placeholder: '+1… ou LERENA' }
        ]
      },
      {
        id: 'http', label: 'Passerelle HTTP (agrégateur)', testHint: 'Envoie un SMS de test au numéro indiqué.',
        fields: [
          { key: 'url', label: 'Adresse d’envoi', required: true, placeholder: 'https://api.agregateur.ci/sms' },
          { key: 'authHeader', label: 'En-tête Authorization', secret: true, placeholder: 'Bearer …' },
          { key: 'sender', label: 'Nom d’expéditeur', placeholder: 'LERENA', hint: 'Corps envoyé : { "to", "text", "sender" }' }
        ]
      }
    ]
  },
  {
    kind: 'WHATSAPP',
    label: 'WhatsApp Business',
    description: 'Rappels, ticket bientôt appelé, suivis, campagnes, rapports du DG et conversations.',
    simulation: 'Les messages sont enregistrés dans le journal ; les visiteurs les reçoivent par SMS à la place.',
    testTarget: { label: 'Envoyer un message de test au', placeholder: '+225 07 00 00 00 00', type: 'phone' },
    providers: [
      {
        id: 'meta', label: 'Meta (API Cloud WhatsApp)', testHint: 'Envoie le modèle « hello_world » au numéro indiqué (numéro déclaré comme destinataire de test chez Meta).',
        fields: [
          { key: 'phoneNumberId', label: 'Identifiant du numéro', required: true, placeholder: '1234567890' },
          { key: 'accessToken', label: 'Jeton d’accès permanent', secret: true, required: true },
          { key: 'apiVersion', label: 'Version de l’API', placeholder: 'v21.0' },
          { key: 'verifyToken', label: 'Jeton de vérification du webhook', secret: true, hint: 'Choisi par vous, à recopier chez Meta. Adresse du webhook : /api/whatsapp/webhook' },
          { key: 'appSecret', label: 'Clé secrète de l’application Meta', secret: true, hint: 'Vérifie que les messages reçus viennent bien de Meta' }
        ]
      },
      {
        id: '360dialog', label: '360dialog', testHint: 'Envoie un message de test au numéro indiqué.',
        fields: [
          { key: 'apiKey', label: 'Clé API (D360-API-KEY)', secret: true, required: true },
          { key: 'verifyToken', label: 'Jeton du webhook', secret: true, hint: 'Adresse à déclarer : /api/whatsapp/webhook?token=<jeton>' }
        ]
      },
      {
        id: 'twilio', label: 'Twilio WhatsApp', testHint: 'Envoie un message de test au numéro indiqué.',
        fields: [
          { key: 'accountSid', label: 'Account SID', required: true },
          { key: 'authToken', label: 'Auth token', secret: true, required: true },
          { key: 'from', label: 'Numéro WhatsApp', required: true, placeholder: '+14155238886' },
          { key: 'verifyToken', label: 'Jeton du webhook', secret: true, hint: 'Adresse à déclarer : /api/whatsapp/webhook?token=<jeton>' }
        ]
      }
    ]
  },
  {
    kind: 'PUSH',
    label: 'Notifications push',
    description: 'Notifications sur téléphone et ordinateur, même application fermée (standard Web, sans fournisseur payant).',
    simulation: 'Sans clés, aucune notification push ; les notifications restent visibles dans l’application.',
    providers: [
      {
        id: 'vapid', label: 'Clés Lerena (VAPID)', testHint: 'Envoie une notification de test à vos appareils abonnés.',
        fields: [
          { key: 'publicKey', label: 'Clé publique', required: true },
          { key: 'privateKey', label: 'Clé privée', secret: true, required: true },
          { key: 'subject', label: 'Contact', placeholder: 'mailto:contact@lerena.ci' }
        ]
      }
    ]
  },
  {
    kind: 'AI',
    label: 'IA (analyse avancée)',
    description: 'Regroupement fin des commentaires libres et rédaction plus naturelle des synthèses. Textes anonymisés seulement.',
    simulation: 'L’assistant d’analyse intégré travaille seul, sans service extérieur.',
    providers: [
      {
        id: 'anthropic', label: 'API Claude (Anthropic)', testHint: 'Pose une question courte au modèle et affiche sa réponse.',
        fields: [
          { key: 'apiKey', label: 'Clé API', secret: true, required: true, placeholder: 'sk-ant-…' },
          { key: 'model', label: 'Modèle', placeholder: 'claude-opus-5-5' }
        ]
      }
    ]
  },
  {
    kind: 'PAYMENT',
    label: 'Paiement en ligne',
    description: 'Paiement des commandes de la boutique et des factures par Mobile Money ou carte.',
    simulation: 'Les paiements sont validés à la main par l’équipe de l’établissement.',
    providers: [
      {
        id: 'wave', label: 'Wave', testHint: 'Crée un lien de paiement de 100 FCFA (rien n’est débité tant que personne ne paie).',
        fields: [{ key: 'apiKey', label: 'Clé API', secret: true, required: true, placeholder: 'wave_ci_prod_…' }]
      },
      {
        id: 'cinetpay', label: 'CinetPay (Orange, MTN, Moov, Wave, carte)', testHint: 'Crée un lien de paiement de 100 FCFA (rien n’est débité tant que personne ne paie).',
        fields: [
          { key: 'apiKey', label: 'Clé API', secret: true, required: true },
          { key: 'siteId', label: 'Site ID', required: true }
        ]
      }
    ]
  },
  {
    kind: 'AUTH',
    label: 'Connexion Google ou Microsoft',
    description: 'Connexion des équipes d’entreprise avec leur compte Google ou Microsoft (étape N9).',
    simulation: 'Connexion par mot de passe et double authentification uniquement.',
    providers: [
      {
        id: 'google', label: 'Google', testHint: 'Vérifie que les identifiants sont complets.',
        fields: [
          { key: 'clientId', label: 'Client ID', required: true },
          { key: 'clientSecret', label: 'Client secret', secret: true, required: true }
        ]
      },
      {
        id: 'microsoft', label: 'Microsoft (Entra ID)', testHint: 'Vérifie que les identifiants sont complets.',
        fields: [
          { key: 'clientId', label: 'Application (client) ID', required: true },
          { key: 'clientSecret', label: 'Client secret', secret: true, required: true },
          { key: 'tenantId', label: 'Tenant ID', placeholder: 'common' }
        ]
      }
    ]
  }
]

export const integrationDefinition = (kind: IntegrationKind) => INTEGRATIONS.find(i => i.kind === kind)!
export const providerDefinition = (kind: IntegrationKind, provider: string) => integrationDefinition(kind).providers.find(p => p.id === provider)
export const isIntegrationKind = (k: unknown): k is IntegrationKind => typeof k === 'string' && INTEGRATIONS.some(i => i.kind === k)
