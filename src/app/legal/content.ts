// Documents légaux de Lerena. Les coordonnées de la société viennent de la console (Facturation) :
// une information manquante s'affiche « à compléter ». Textes à faire relire par un juriste avant le lancement.

export const TERMS_VERSION = '2026-11'
export const LEGAL_UPDATED_AT = '2 novembre 2026'

export interface LegalContext {
  company: string
  address: string
  rccm: string
  taxId: string
  email: string
  phone: string
  dpo: string
  artci: string
  retentionMonths: number
}

export interface LegalSection { title: string; paragraphs: string[]; list?: string[] }
export interface LegalDoc { slug: string; title: string; short: string; intro: string; sections: (c: LegalContext) => LegalSection[] }

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'cgu',
    title: 'Conditions générales d’utilisation',
    short: 'CGU',
    intro: 'Règles d’utilisation de Lerena par les visiteurs : prise de ticket, suivi de la file et rendez-vous.',
    sections: c => [
      { title: '1. Objet', paragraphs: [`Lerena, édité par ${c.company}, permet de prendre un ticket virtuel, de suivre sa place dans une file d’attente et de réserver un rendez-vous auprès des établissements qui utilisent le service (hôpitaux, administrations, banques, commerces…).`, 'Utiliser Lerena vaut acceptation des présentes conditions.'] },
      { title: '2. Accès au service', paragraphs: ['Le service est gratuit pour les visiteurs. Il peut être utilisé avec un compte (numéro de téléphone et code personnel) ou sans compte (prénom et numéro de téléphone, éventuellement vérifié par un code SMS).', 'Vous vous engagez à fournir des informations exactes et à garder votre code personnel secret.'] },
      { title: '3. Tickets et rendez-vous', paragraphs: ['Le temps d’attente affiché est une estimation : il dépend de l’affluence et du rythme de l’établissement, qui reste seul maître de l’ordre de passage, des priorités (personnes âgées, femmes enceintes, urgences…) et des horaires.', 'Un ticket non présenté à l’appel peut être marqué « absent ». Un rendez-vous non honoré peut limiter vos réservations futures dans cet établissement.'] },
      { title: '4. Bon usage', paragraphs: ['Il est interdit de prendre des tickets ou rendez-vous fictifs, de revendre une place, d’automatiser des demandes ou de perturber le service. Lerena peut limiter ou suspendre un accès abusif.'] },
      { title: '5. Notifications et SMS', paragraphs: ['Avec votre accord, Lerena vous prévient quand votre tour approche (notification sur le téléphone ou SMS). Vous pouvez retirer cet accord à tout moment dans les réglages de votre navigateur ou de votre profil.'] },
      { title: '6. Responsabilité', paragraphs: ['Lerena est un outil technique : le service rendu au guichet relève de l’établissement. Lerena met tout en œuvre pour que le service soit disponible, sans pouvoir garantir l’absence d’interruption (maintenance, réseau, électricité).'] },
      { title: '7. Données personnelles', paragraphs: ['Le traitement de vos données est décrit dans la politique de confidentialité. Vous pouvez supprimer votre compte depuis le profil et demander une copie de vos données.'] },
      { title: '8. Propriété intellectuelle', paragraphs: ['La marque Lerena, l’application et leurs contenus sont protégés. Toute reproduction non autorisée est interdite.'] },
      { title: '9. Modification et droit applicable', paragraphs: ['Ces conditions peuvent évoluer ; la version en vigueur est toujours disponible sur cette page. Elles sont soumises au droit ivoirien ; à défaut d’accord amiable, les tribunaux d’Abidjan sont compétents.', `Contact : ${c.email}.`] }
    ]
  },
  {
    slug: 'cgv',
    title: 'Conditions générales de vente',
    short: 'CGV',
    intro: 'Conditions applicables aux établissements abonnés à Lerena.',
    sections: c => [
      { title: '1. Objet', paragraphs: [`Les présentes conditions régissent l’abonnement des établissements (« le Client ») au service Lerena fourni par ${c.company} (« Lerena ») : gestion de files d’attente, écrans d’appel, bornes, rendez-vous, statistiques, ainsi que les services et matériels commandés au catalogue.`] },
      { title: '2. Essai et souscription', paragraphs: ['Un essai gratuit peut être proposé ; sa durée et son contenu sont indiqués dans l’espace Abonnement. À son terme, le Client choisit un forfait ; à défaut de paiement, le service en ligne est suspendu après le délai de grâce.'] },
      { title: '3. Prix', paragraphs: ['L’abonnement est facturé par site et par mois, hors taxes, selon la grille en vigueur au jour de la facture ; un prix négocié et inscrit au contrat prévaut. Le paiement annuel bénéficie de la remise indiquée. Les packs SMS, la mise en avant, le matériel et l’installation sont facturés selon le catalogue.'] },
      { title: '4. Facturation et paiement', paragraphs: ['Les factures sont émises par voie électronique et payables à l’échéance indiquée, par Mobile Money (Orange Money, MTN, Wave, Moov), virement, chèque ou espèces, en rappelant le numéro de facture. Les services commandés (SMS, mise en avant) sont activés à réception du paiement.'] },
      { title: '5. Retard de paiement', paragraphs: ['Après l’échéance, un délai de grâce s’applique, signalé dans le tableau de bord. Passé ce délai, la prise de tickets en ligne est suspendue jusqu’au paiement ; les données du Client sont conservées et l’accès est rétabli dès l’encaissement.'] },
      { title: '6. Durée et résiliation', paragraphs: ['L’abonnement est conclu pour la période payée (mois ou année) et se renouvelle par le paiement de la facture suivante. Le Client peut y mettre fin à tout moment avec effet à la fin de la période en cours ; les sommes versées pour une période entamée restent acquises.'] },
      { title: '7. Engagements de Lerena', paragraphs: ['Lerena assure l’hébergement, la maintenance, les sauvegardes quotidiennes et l’assistance aux jours et heures ouvrés (prioritaire pour les forfaits qui l’incluent), et vise une disponibilité de 99,5 % par mois hors maintenance annoncée.'] },
      { title: '8. Engagements du Client', paragraphs: ['Le Client gère les comptes de son équipe, garde leurs accès confidentiels, informe ses visiteurs de l’utilisation de Lerena (affiche fournie) et s’assure de disposer d’une connexion Internet et d’un matériel compatibles.'] },
      { title: '9. Données personnelles', paragraphs: ['Pour les données de ses visiteurs, le Client est responsable du traitement et Lerena agit comme sous-traitant, dans les conditions du contrat de sous-traitance des données, qui fait partie des présentes.'] },
      { title: '10. Matériel', paragraphs: ['Le matériel vendu devient la propriété du Client au paiement complet ; il bénéficie de la garantie du fabricant. Le matériel loué reste la propriété de Lerena et doit être restitué en bon état à la fin de la location.'] },
      { title: '11. Responsabilité', paragraphs: ['La responsabilité de Lerena est limitée aux dommages directs et plafonnée aux sommes payées par le Client au cours des douze derniers mois.'] },
      { title: '12. Droit applicable', paragraphs: ['Droit ivoirien ; à défaut d’accord amiable, compétence des tribunaux de commerce d’Abidjan.', `Contact commercial : ${c.email} · ${c.phone}.`] }
    ]
  },
  {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    short: 'Confidentialité',
    intro: 'Quelles données Lerena utilise, pourquoi, combien de temps, et comment exercer vos droits (loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel).',
    sections: c => [
      { title: '1. Qui est responsable ?', paragraphs: [`${c.company}, ${c.address}, est responsable des données de votre compte Lerena. Pour les tickets et rendez-vous pris dans un établissement, celui-ci est responsable du traitement et Lerena agit pour son compte.`, `Contact données personnelles : ${c.dpo}.`, `Déclaration auprès de l’ARTCI : ${c.artci}.`] },
      { title: '2. Données utilisées', paragraphs: ['Uniquement ce qui sert au service :'], list: [
        'Compte : nom, numéro de téléphone, e-mail facultatif, code personnel (enregistré sous forme chiffrée, jamais lisible).',
        'Tickets et rendez-vous : établissement, service, horaires, statut ; pour une prise sans compte, prénom et numéro de téléphone.',
        'Position : utilisée seulement sur votre téléphone pour trier les établissements par distance, ou vérifiée au moment de la prise de ticket si l’établissement l’exige ; elle n’est pas conservée.',
        'Notifications : l’adresse technique d’abonnement de votre navigateur, si vous les activez.',
        'Sécurité : adresse IP et type d’appareil lors des connexions, pour bloquer les abus et vous montrer vos sessions.'
      ] },
      { title: '3. Pourquoi', paragraphs: ['Fournir le service demandé (ticket, rendez-vous, suivi), vous prévenir quand votre tour approche (avec votre accord), sécuriser les comptes, produire des statistiques anonymes pour les établissements, et respecter nos obligations légales (facturation des établissements).'] },
      { title: '4. Qui voit vos données', paragraphs: ['L’établissement auprès duquel vous prenez un ticket ou un rendez-vous ; l’équipe Lerena habilitée, pour l’assistance ; nos prestataires techniques, tenus à la confidentialité : hébergement de l’application (Vercel), base de données (Supabase, hébergée dans l’Union européenne), envoi des e-mails et des SMS. Vos données ne sont jamais vendues ni utilisées pour de la publicité ciblée.', 'L’hébergement hors de Côte d’Ivoire fait l’objet des garanties et formalités prévues par la loi auprès de l’ARTCI.'] },
      { title: '5. Combien de temps', paragraphs: [`Tickets et rendez-vous : anonymisés ${c.retentionMonths} mois après leur date (les statistiques restent, les noms et numéros disparaissent). Contenu des SMS et e-mails : effacé après 6 mois. Traces de connexion : 30 à 90 jours. Compte : jusqu’à sa suppression, que vous pouvez demander à tout moment.`] },
      { title: '6. Sécurité', paragraphs: ['Connexions chiffrées (HTTPS), codes et mots de passe chiffrés, double authentification pour les administrateurs, liens d’accès à usage unique, journal des actions sensibles, sauvegardes quotidiennes.'] },
      { title: '7. Vos droits', paragraphs: ['Vous pouvez accéder à vos données, en obtenir une copie, les rectifier, vous opposer à leur utilisation ou les faire supprimer. La suppression du compte se fait directement depuis le profil ; pour une copie de vos données, utilisez « Profil → Demander une copie de mes données » ou écrivez au contact ci-dessus : réponse sous 30 jours.', 'Vous pouvez aussi saisir l’ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire).'] },
      { title: '8. Cookies', paragraphs: ['Lerena n’utilise que des cookies indispensables : la session de connexion et le choix du site pour les équipes. Aucun cookie publicitaire ni de mesure d’audience tierce : aucun consentement n’est donc demandé pour les cookies.'] },
      { title: '9. Mineurs', paragraphs: ['Le service peut être utilisé par un mineur accompagné ou avec l’accord de ses parents ; aucune donnée n’est collectée à des fins commerciales.'] }
    ]
  },
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    short: 'Mentions légales',
    intro: 'Informations sur l’éditeur et l’hébergeur de Lerena.',
    sections: c => [
      { title: 'Éditeur', paragraphs: [c.company, c.address, `RCCM : ${c.rccm} · Compte contribuable : ${c.taxId}`, `${c.phone} · ${c.email}`] },
      { title: 'Hébergement', paragraphs: ['Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.', 'Base de données : Supabase Inc., serveurs situés dans l’Union européenne (Stockholm, Suède).'] },
      { title: 'Données personnelles', paragraphs: [`Déclaration ARTCI : ${c.artci}. Contact : ${c.dpo}. Voir la politique de confidentialité.`] }
    ]
  },
  {
    slug: 'sous-traitance',
    title: 'Contrat de sous-traitance des données',
    short: 'Sous-traitance',
    intro: 'Annexe aux conditions générales de vente : engagements de Lerena lorsqu’il traite les données des visiteurs pour le compte d’un établissement.',
    sections: c => [
      { title: '1. Rôles', paragraphs: [`L’établissement (« le Responsable ») détermine pourquoi et comment les données de ses visiteurs sont utilisées. ${c.company} (« le Sous-traitant ») les traite uniquement pour fournir Lerena et sur ses instructions.`] },
      { title: '2. Données et traitements', paragraphs: ['Catégories de personnes : visiteurs et membres de l’équipe du Responsable.'], list: [
        'Données : nom ou prénom, numéro de téléphone, e-mail éventuel, tickets, rendez-vous, horaires, statut de passage, notes internes des agents.',
        'Opérations : enregistrement, affichage (écrans d’appel : numéro de ticket et guichet seulement, jamais le nom ni le motif de priorité), notifications, statistiques, conservation, anonymisation.',
        'Durée : celle de l’abonnement, puis restitution ou suppression.'
      ] },
      { title: '3. Données sensibles', paragraphs: ['Lerena n’a pas vocation à recevoir des données de santé. Le Responsable nomme ses services sans information médicale identifiante et demande à ses agents de ne pas inscrire de diagnostic dans les notes.'] },
      { title: '4. Engagements du Sous-traitant', list: [
        'Traiter les données sur instruction documentée du Responsable, et pour aucune autre fin.',
        'Garantir la confidentialité : accès limité aux personnes habilitées, tenues au secret.',
        'Mettre en œuvre les mesures de sécurité décrites dans la politique de confidentialité (chiffrement, contrôle d’accès, journalisation, sauvegardes).',
        `Ne recourir qu’aux sous-traitants ultérieurs listés (Vercel, Supabase, fournisseurs d’e-mails et de SMS) et informer le Responsable de tout changement.`,
        'Aider le Responsable à répondre aux demandes des personnes (accès, suppression, export) et à ses obligations auprès de l’ARTCI.',
        'Notifier toute violation de données dans les meilleurs délais, au plus tard 72 heures après en avoir eu connaissance.',
        'En fin de contrat, restituer les données (export) puis les supprimer sous 30 jours, sauf obligation légale de conservation.',
        'Mettre à disposition les informations nécessaires pour démontrer le respect de ces engagements.'
      ], paragraphs: [] },
      { title: '5. Engagements du Responsable', paragraphs: ['Informer ses visiteurs (affiche Lerena et politique de confidentialité), disposer d’une base légale pour le traitement, accomplir ses propres formalités auprès de l’ARTCI, et donner des instructions conformes à la loi.'] },
      { title: '6. Contact', paragraphs: [`${c.dpo}`] }
    ]
  }
]

export const legalDoc = (slug: string) => LEGAL_DOCS.find(d => d.slug === slug)
