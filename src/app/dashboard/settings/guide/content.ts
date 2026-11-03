// Guide d'utilisation affiché dans Paramètres → Guide d'utilisation.
// À METTRE À JOUR à chaque évolution de l'application (nouvel écran, nouvelle étape, changement de nom).

export const GUIDE_UPDATED_AT = '3 novembre 2026 (fichier visiteurs, suivis, campagnes SMS, avis)'

export interface GuideSection {
  id: string
  title: string
  intro?: string
  steps?: string[]
  tips?: string[]
}

export const GUIDE: GuideSection[] = [
  {
    id: 'demarrer',
    title: 'Démarrer en 5 étapes',
    intro: 'L’ordre conseillé pour mettre un établissement en service.',
    steps: [
      'Paramètres → Établissement : vérifiez le nom, le secteur, l’adresse et le téléphone.',
      'Paramètres → Localisation & horaires : placez l’établissement sur la carte et saisissez les horaires d’ouverture.',
      'Services : créez les services proposés (ex. « Consultation », « Caisse »), avec leur durée moyenne et leur lettre de ticket.',
      'Guichets : créez vos guichets et indiquez quels services chacun traite.',
      'Paramètres → Équipe & agents : ajoutez vos agents et votre agent d’accueil. Chacun reçoit un mot de passe provisoire, affiché une seule fois.'
    ]
  },
  {
    id: 'demarrage-assistant',
    title: 'Assistant de démarrage et logo',
    intro: 'En haut de la vue d’ensemble, l’assistant liste les 8 étapes pour être prêt ; chacune se coche toute seule.',
    steps: [
      'Cliquez sur une étape pour ouvrir la bonne page ; « Continuer » mène directement à la suivante.',
      'Logo : Paramètres → Établissement → « Logo et couleur ». Il apparaît sur l’écran TV, la borne, le ticket imprimé, le ticket du visiteur, votre fiche et l’affiche.',
      'La couleur personnalisée est comprise dans le forfait Entreprise.',
      'Une fois tout coché, masquez l’assistant avec la croix.'
    ]
  },
  {
    id: 'materiel',
    title: 'Matériel conseillé',
    steps: [
      'Écran : TV Android 43" ou plus, ou TV existante avec un boîtier Android (en vente ou location dans Abonnement → Boutique).',
      'Borne : tablette Android 10" avec support antivol ; imprimante thermique 80 mm facultative. Le bouton « Réimprimer le ticket » relance l’impression si le papier a manqué.',
      'Réseau : la stabilité compte plus que la vitesse ; une box 4G de secours est conseillée. Après une coupure, la borne et l’écran reprennent seuls.',
      'Le guide complet (réglages d’impression, kit type) vous est remis à l’installation.'
    ]
  },
  {
    id: 'appareils',
    title: 'Appareils : la TV et la borne',
    intro: 'Deux types d’appareils peuvent être connectés, autant que vous voulez, chacun indépendamment : ils ne se connectent pas entre eux mais à l’établissement.',
    steps: [
      'Écran d’affichage : la TV de la salle d’attente. Elle montre les numéros appelés, les annonce à voix haute et peut diffuser vos vidéos. Personne ne la touche.',
      'Borne de tickets (facultative) : une tablette à l’entrée. Le visiteur touche « Prendre un ticket », puis son service : le ticket sort aussitôt. Par défaut, la borne ne pose aucune question de priorité (voir la rubrique « Priorités »).',
      'Tablette : Paramètres → Appareils → « Afficher un QR code d’installation ». Scannez-le avec la tablette, touchez « Écran » ou « Borne ». C’est fini. Un nouveau QR code apparaît aussitôt pour l’appareil suivant.',
      'TV : ouvrez l’adresse courte indiquée dans Paramètres → Appareils dans le navigateur de la TV. Un code à 6 chiffres s’affiche : tapez-le dans Paramètres → Appareils, choisissez « Écran d’affichage », puis Connecter.',
      'Chaque appareil se connecte une seule fois : il reste connecté après une coupure de courant, tant qu’on n’efface pas les données de son navigateur.'
    ],
    tips: [
      'Sécurité : le QR code ne sert qu’une fois et expire au bout de 30 minutes. Il disparaît de la barre d’adresse dès son ouverture. Seule une empreinte chiffrée est conservée par Lerena.',
      'Un appareil en trop ou perdu ? « Retirer » dans la liste : il perd immédiatement l’accès.',
      'Le point vert « En ligne » indique que l’appareil a donné signe de vie depuis moins de 2 minutes.',
      'Pour les annonces vocales, touchez une fois l’écran de la TV au démarrage (les navigateurs bloquent le son sans geste de l’utilisateur).'
    ]
  },
  {
    id: 'programme',
    title: 'Programme des écrans (vidéos et publicités)',
    intro: 'Ce réglage s’applique à toutes les TV de l’établissement en même temps.',
    steps: [
      'File seule : uniquement les numéros appelés.',
      'Hybride : la TV alterne entre la file et vos vidéos selon les durées choisies (ex. 30 s / 30 s).',
      'Écran partagé : la file à gauche, la vidéo en boucle à droite.',
      'Ajoutez vos vidéos (lien YouTube ou fichier en ligne) dans la playlist : présentation, offres, messages utiles ou partenaires.'
    ]
  },
  {
    id: 'tickets',
    title: 'Comment les visiteurs prennent un ticket',
    steps: [
      'Avec l’application ou le site : ils choisissent l’établissement, le service, puis « Prendre mon ticket ».',
      'Avec l’affiche QR code (Paramètres → Affiche & QR code) : imprimez-la et collez-la à l’entrée ; un scan suffit, sans compte.',
      'À la borne, s’il y en a une.',
      'Auprès de l’agent d’accueil, qui crée le ticket pour eux (personnes sans téléphone).',
      'Ils suivent ensuite leur position en direct sur leur téléphone et sur la TV, et reçoivent une alerte quand leur tour approche.',
      'Chaque matin, la numérotation repart à 1 dans chaque file (A001, A002…). Les tickets restés ouverts la veille sont clôturés automatiquement pendant la nuit : la file du jour démarre propre.'
    ]
  },
  {
    id: 'rendez-vous',
    title: 'Rendez-vous',
    intro: 'Paramètres → Rendez-vous : mode de l’établissement (file, rendez-vous ou les deux), règles, réglages par service et jours de fermeture.',
    steps: [
      'Le visiteur réserve depuis la fiche de l’établissement, avec ou sans compte (prénom et téléphone). Il reçoit un code d’arrivée à 6 chiffres et un lien pour voir, reporter ou annuler son rendez-vous.',
      'Rappels automatiques par SMS la veille et 2 heures avant.',
      'Chaque nouvelle réservation faite par un visiteur est envoyée par e-mail aux responsables et à l’accueil (et à l’adresse de l’établissement). Dans le menu, une pastille sur « Agenda » compte les nouveaux rendez-vous depuis votre dernière visite.',
      'À l’arrivée : le visiteur tape son code sur la borne (« J’ai un rendez-vous »), ou l’accueil le signale dans « Rendez-vous du jour ». Un ticket est créé et placé à l’heure du rendez-vous : il ne repasse pas derrière la file.',
      'Sans arrivée après le délai fixé (15 minutes par défaut), le rendez-vous est noté « absent ». Vous pouvez bloquer la réservation en ligne après plusieurs absences.',
      'Par service : nombre de personnes reçues sur un même créneau, délai minimum avant un rendez-vous, et jusqu’à combien de jours à l’avance.',
      'Jours fériés et fermetures exceptionnelles : ajoutez-les pour qu’aucun rendez-vous ne soit possible ces jours-là, pour un site ou pour tous.'
    ]
  },
  {
    id: 'agents',
    title: 'Au guichet et à l’accueil',
    steps: [
      'Agent : il se connecte (espace professionnel), choisit son guichet puis touche « Appeler le suivant ». Le numéro s’affiche et s’annonce sur la TV.',
      'Il peut rappeler un client, le marquer absent ou le mettre en attente (document manquant).',
      'Agent d’accueil : il crée des tickets pour les visiteurs, oriente vers le bon service et voit l’affluence de tous les guichets.',
      'Priorités : les motifs définis dans Paramètres → Priorités passent avant dans la file (voir la rubrique « Priorités »).'
    ]
  },
  {
    id: 'visiteurs',
    title: 'Fichier visiteurs',
    intro: 'Chaque visiteur venu avec son numéro ou son compte Lerena a sa fiche, créée et mise à jour toute seule à chaque ticket et rendez-vous. Menu « Visiteurs » du tableau de bord, bouton « Visiteurs » à l’accueil.',
    steps: [
      'Cherchez un visiteur par son nom ou son numéro, ou ouvrez un segment : Nouveaux (moins de 30 jours), Habitués (3 passages et plus), À relancer (pas revenus depuis 90 jours), Absents répétés (2 absences et plus), Mécontents (dernière note de 2 étoiles ou moins).',
      'La fiche montre ses passages, absences, rendez-vous à venir et sa note moyenne, puis tout son historique : tickets, guichet, attente, durée au guichet, note donnée, rendez-vous.',
      'Boutons « Appeler », « WhatsApp » et « Rendez-vous » : le rendez-vous est confirmé au visiteur par SMS avec son code d’arrivée.',
      'Étiquettes : créez les vôtres (« Fauteuil roulant », « Interprète », « VIP »…) et posez-les sur la fiche. Elles s’affichent au guichet quand le visiteur est appelé, et dans les derniers tickets de l’accueil.',
      'Notes de l’équipe : datées et signées, visibles par l’accueil et le responsable seulement. Une note se supprime par son auteur ou par le responsable.',
      '« Nouvelle fiche » : ajoutez un visiteur connu (appel téléphonique, ancienne liste). Si le numéro existe déjà, sa fiche s’ouvre.',
      'L’agent de guichet voit uniquement le nom, les étiquettes et le nombre de passages du visiteur qu’il appelle.'
    ],
    tips: [
      'Un visiteur sans numéro ni compte (ticket de borne anonyme) n’a pas de fiche.',
      'Les passages antérieurs au fichier visiteurs ont été repris automatiquement.'
    ]
  },
  {
    id: 'suivis',
    title: 'Suivis, absences et rendez-vous récurrents',
    intro: 'Pour faire revenir les visiteurs au bon moment et réduire les rendez-vous manqués. Inclus à partir du forfait Pro.',
    steps: [
      'Sur la fiche d’un visiteur, carte « Suivis » → « Programmer » : objet (« Contrôle », « Renouvellement »…), date (raccourcis 1 semaine, 1, 3 ou 6 mois), personne de l’équipe à qui le confier.',
      'Cochez « Prévenir le visiteur par SMS ce jour-là » : il reçoit le rappel à partir de 8 h, avec le lien pour réserver son créneau (1 SMS décompté).',
      'Menu « À faire » (bouton « À faire » à l’accueil) : suivis en retard et du jour, puis ceux des 14 prochains jours. Appelez, puis cochez : le suivi passe dans « Faits cette semaine ». La pastille du menu indique ce qui reste pour aujourd’hui.',
      'Rendez-vous récurrents : fiche → « Rendez-vous » → choisissez le premier créneau, puis « Chaque semaine », « Toutes les 2 semaines » ou « Chaque mois » et le nombre de rendez-vous. Toute la série est réservée d’un coup ; un seul SMS récapitule les dates et chaque rendez-vous a son rappel la veille. Les dates impossibles (jour fermé, complet) sont listées.',
      'Absences : après un rendez-vous manqué, le visiteur reçoit un SMS avec le lien pour reprendre un créneau (réglable dans Paramètres → Rendez-vous). Au seuil d’absences, sa fiche reçoit l’étiquette « Absences répétées ».'
    ]
  },
  {
    id: 'campagnes',
    title: 'Messages et campagnes SMS',
    intro: 'Écrire à un visiteur ou prévenir tout un groupe en quelques minutes. Inclus à partir du forfait Pro ; chaque SMS est décompté de vos SMS du mois, puis de vos packs.',
    steps: [
      'Accord des visiteurs : ils acceptent vos messages depuis leur ticket (« Nouvelles de … par SMS ») ou à l’accueil (« Il accepte » sur la fiche). Les campagnes ne partent qu’à eux.',
      'Menu « Campagnes » → « Nouvelle campagne » : 1. destinataires (segment, étiquette ou visiteurs choisis), 2. message (modèle prêt à l’emploi, variables {prénom}, {établissement}, {lien}, {service}, {date}), 3. maintenant ou à une date. L’aperçu montre le SMS reçu ; le nombre de SMS et votre solde s’affichent avant l’envoi.',
      'Remplacez les passages entre crochets des modèles ([date], [service]) : l’envoi reste bloqué tant qu’il en reste.',
      'Les SMS partent entre 8 h et 20 h. Suivez l’envoi sur la page de la campagne : envoyés, échecs, non envoyés, désinscriptions. Une campagne programmée ou en cours peut être annulée ; « Dupliquer » repart du même message.',
      'Chaque SMS de campagne se termine par un lien STOP : un appui suffit pour ne plus rien recevoir de votre établissement. La fiche indique alors « A répondu STOP ».',
      'SMS à une personne : fiche visiteur → « SMS » (résultats prêts, document manquant…). Les SMS qu’il a reçus de vous s’affichent sur sa fiche.'
    ],
    tips: [
      'Pas de diagnostic ni d’information médicale par SMS.',
      'Si vos SMS s’épuisent pendant une campagne, le reste n’est pas envoyé : achetez un pack (Abonnement → Boutique) puis dupliquez la campagne vers les visiteurs restants.'
    ]
  },
  {
    id: 'avis',
    title: 'Avis des visiteurs et réclamations',
    intro: 'Après son passage, le visiteur note de 1 à 5 étoiles sur son ticket, puis peut préciser ce qui n’a pas été et laisser un commentaire. Inclus dans tous les forfaits.',
    steps: [
      'Une note de 2 étoiles ou moins, ou un 3 avec un motif ou un commentaire négatif, arrive dans le menu « Avis » (pastille), et les responsables reçoivent un e-mail. Objectif : traiter sous 48 h ; les avis plus anciens sont signalés en rouge.',
      'Ouvrez l’avis : note, commentaire, ticket, service, guichet, attente. « Appeler » (l’appel est noté dans l’historique), « SMS » pour répondre au visiteur, « Note » pour garder une trace.',
      '« Clôturer avec la cause » : attente, accueil, erreur ou oubli, propreté, autre, et ce qui a été fait. L’avis passe dans « Traités » ; il peut être rouvert.',
      'Onglet « Satisfaction » : note moyenne et part des passages notés sur 8 semaines, évolution par semaine, répartition des notes, causes les plus fréquentes, services et guichets les moins bien notés, part des avis traités sous 48 h.',
      'Le commentaire du visiteur apparaît aussi dans l’historique de sa fiche.'
    ]
  },
  {
    id: 'parcours',
    title: 'Un visiteur qui passe par plusieurs services',
    intro: 'Le parcours n’est pas prévu à l’avance : chaque personne qui reçoit le visiteur décide où il doit aller ensuite.',
    steps: [
      'Le visiteur garde le même numéro de ticket du début à la fin.',
      'Quand il a fini à un guichet (ou s’il n’est pas au bon endroit), l’agent touche « Transférer » (touche X), choisit le service suivant et peut laisser une note au collègue.',
      'Le visiteur reçoit une notification « Étape 2 : Caisse » et sa page de suivi affiche les étapes déjà faites puis l’étape en cours.',
      'Dans le nouveau service, il se place derrière la dernière personne arrivée, comme tout le monde — sauf s’il a une priorité.',
      'L’agent suivant voit l’étape et les services déjà passés, ainsi que la note. Le dernier agent touche « Terminé ».',
      'Le guichet qui vient de transférer un client ne le revoit pas dans sa file : il est laissé aux autres guichets du service suivant. S’il est le seul guichet à traiter ce service, il le garde (la fenêtre de transfert l’indique).'
    ],
    tips: [
      'Indispensable : dans « Guichets », cochez les services que chaque guichet traite. Un guichet sans service coché traite tous les services, et les transferts reviennent alors chez lui.'
    ]
  },
  {
    id: 'priorites',
    title: 'Priorités',
    intro: 'Chaque établissement décide qui passe devant : Paramètres → Priorités.',
    steps: [
      'Créez vos motifs (ex. « Personne en situation de handicap », « Femme enceinte », « Urgence ») et choisissez leur niveau : Prioritaire ou Très prioritaire.',
      'Dans une file : les très prioritaires d’abord, puis les prioritaires, puis tous les autres dans l’ordre d’arrivée.',
      'Par défaut, seul l’agent d’accueil attribue une priorité : la personne se présente à l’accueil, qui l’ajoute à son ticket.',
      'En haut de Paramètres → Priorités, deux interrupteurs permettent de laisser le visiteur choisir lui-même sa priorité : dans l’application mobile, et/ou sur la borne. Ils sont désactivés au départ, car certains visiteurs pourraient en abuser.',
      'Quand un interrupteur est activé, seuls les motifs cochés « Proposé aux visiteurs » sont proposés (décochez par exemple « Urgence »).',
      'À l’accueil, une priorité peut aussi être ajoutée ou retirée sur un ticket déjà émis.'
    ],
    tips: [
      'Discrétion : le motif est visible du personnel uniquement ; la TV affiche seulement « Prioritaire ».',
      'Sans aucun motif actif, tout le monde est servi dans l’ordre d’arrivée.'
    ]
  },
  {
    id: 'pilotage',
    title: 'Piloter l’activité',
    steps: [
      'Vue d’ensemble : personnes en attente, attente la plus longue, personnes servies, guichets ouverts.',
      'File : tous les tickets en cours, en direct.',
      'Planning : qui travaille à quel guichet, semaine par semaine.',
      'Statistiques : affluence par heure et par jour, durées d’attente et de service, comparaison avec la période précédente, rapport imprimable.',
      'Paramètres → Opérations & données : remise à zéro de la file en fin de journée, export des tickets.'
    ]
  },
  {
    id: 'sites',
    title: 'Plusieurs sites dans un établissement',
    steps: [
      'Paramètres → Sites : ajoutez vos agences ou antennes. Un nouveau site peut reprendre les services du site actif.',
      'En haut du menu de gauche (sous le nom de l’établissement), choisissez le site sur lequel vous travaillez ; « Tous les sites » donne la vue d’ensemble.',
      'Services, guichets, horaires, planning, écrans et bornes se règlent site par site. Chaque site a sa propre file d’attente.',
      'L’agent travaille sur le site de son guichet ; la TV et la borne affichent leur site. Le visiteur choisit son site sur la fiche de l’établissement.'
    ]
  },
  {
    id: 'reseau',
    title: 'Plusieurs agences (réseau)',
    intro: 'Chaque agence est un établissement distinct : ses propres tickets, ses propres TV et bornes, son propre responsable.',
    steps: [
      'Les appareils d’une agence se connectent depuis le tableau de bord de cette agence : une TV de l’agence A n’affiche jamais les tickets de l’agence B.',
      'Le siège (administrateur du réseau) suit toutes les agences dans l’espace réseau : affluence en direct, création de nouvelles agences, rapport mensuel.'
    ]
  },
  {
    id: 'abonnement',
    title: 'Abonnement, factures et boutique',
    intro: 'Menu de gauche → Abonnement : votre forfait, votre consommation du mois, vos factures et la boutique.',
    steps: [
      'Le prix est fixé par site et par mois. Pendant l’essai gratuit, tout le forfait est disponible ; un bandeau vous prévient 7 jours avant la fin.',
      'Changer de forfait : choisissez-le dans « Changer de forfait » (mensuel ou annuel, moins cher). Le nouveau tarif s’applique à la prochaine facture. Pour le forfait sur devis, l’équipe Lerena vous recontacte.',
      'Les limites du forfait (guichets, services, tickets du mois, SMS inclus) s’affichent sous forme de jauges. Une fois une limite atteinte, l’ajout est refusé avec un message clair ; l’accueil peut toujours créer un ticket sur place.',
      'Payer une facture : par Orange Money, MTN, Wave, Moov ou virement, en indiquant le numéro de facture. Cliquez ensuite sur « J’ai payé » et donnez la référence de la transaction : Lerena confirme et votre service est prolongé.',
      'Sans paiement après l’échéance, un délai de grâce s’ouvre (bandeau orange), puis les tickets en ligne sont suspendus. Vos données restent intactes et tout repart dès le paiement.',
      'Boutique : packs SMS (utilisés après les SMS inclus), mise en avant « À la une » en tête de la recherche, matériel en vente ou en location, installation et formation. Une facture est créée ; l’article s’active à son paiement.',
      'Chaque facture s’ouvre en grand et s’imprime ou s’enregistre en PDF (bouton « Imprimer / PDF »).'
    ]
  },
  {
    id: 'donnees-visiteurs',
    title: 'Données de vos visiteurs',
    intro: 'Vous êtes responsable des données de vos visiteurs ; Lerena les traite pour vous, selon le contrat de sous-traitance (lien en bas de la page de connexion).',
    steps: [
      'Affichez l’affiche Lerena à l’entrée : elle informe vos visiteurs.',
      'Nommez vos services sans information sensible (« Consultation » plutôt qu’un examen précis) et n’écrivez pas de diagnostic dans les notes des agents.',
      'Les écrans n’affichent que le numéro de ticket et le guichet : jamais le nom ni le motif de priorité.',
      'Après 12 mois, les noms, numéros et notes des tickets sont effacés automatiquement ; vos statistiques restent.',
      'Fiches visiteurs : supprimées automatiquement après 12 mois sans passage ni rendez-vous, sauf si le visiteur a accepté de recevoir vos messages (case sur sa fiche). Chaque consultation de fiche est inscrite au journal.',
      'Notes de fiche : n’y écrivez ni diagnostic ni information médicale, seulement ce qui aide à mieux accueillir.',
      'Un visiteur peut supprimer son compte depuis son profil (ses fiches disparaissent alors dans tous les établissements) et demander une copie de ses données ; l’équipe Lerena y répond sous 30 jours.'
    ]
  },
  {
    id: 'compte',
    title: 'Compte et sécurité',
    steps: [
      'Mot de passe oublié : sur la page de connexion, « Mot de passe oublié ? ». Avec un e-mail, vous recevez un lien valable 1 heure ; avec un numéro, un code par SMS.',
      'Un collaborateur créé dans « Équipe & agents » reçoit un mot de passe provisoire (affiché une fois et envoyé par e-mail). Il doit le remplacer à sa première connexion.',
      'Double authentification : depuis « Sécurité du compte » (bouton bouclier ou fenêtre « Mon profil »), activez un code à 6 chiffres via une application comme Google Authenticator. Elle est fortement conseillée aux administrateurs de réseau et de la plateforme (un bandeau le rappelle) et deviendra obligatoire pour eux en production. Notez vos 8 codes de secours.',
      'Appareils connectés : « Sécurité du compte » liste les appareils ouverts sur votre compte ; vous pouvez en déconnecter un, ou tous les autres.',
      'Les postes du personnel inactifs depuis 12 heures sont déconnectés automatiquement.'
    ],
    tips: [
      'Après 5 erreurs de mot de passe, la connexion est bloquée 15 minutes pour ce compte.',
      'Clients : un code PIN d’au moins 6 chiffres. Personnel : un mot de passe de 8 caractères avec lettres et chiffres.'
    ]
  },
  {
    id: 'notifications',
    title: 'Notifications et SMS',
    steps: [
      'Les visiteurs qui suivent leur ticket dans l’application sont prévenus gratuitement par notification quand leur tour approche et quand c’est leur tour.',
      'Paramètres → Notifications : activez les SMS « vous êtes le prochain » et « c’est votre tour » pour les visiteurs sans notification (ticket pris à l’accueil ou à la borne avec un numéro). Au plus 2 SMS par ticket.',
      'La même page affiche le nombre de SMS et d’e-mails envoyés dans le mois.'
    ]
  },
  {
    id: 'problemes',
    title: 'En cas de problème',
    steps: [
      'Une TV ou une borne affiche un vieux code, ou ne bouge plus : rechargez sa page. Les appareils se mettent aussi à jour tout seuls après chaque nouvelle version d’Lerena.',
      '« Code inconnu ou expiré » : le code a plus de 15 minutes ; rechargez la page sur l’appareil et tapez le nouveau code.',
      '« Lien expiré ou déjà utilisé » : affichez un nouveau QR code dans Paramètres → Appareils.',
      'Un appareil apparaît deux fois : retirez la ligne en trop.',
      'Écran « Pas de connexion » : l’appareil n’a plus internet ; la page se recharge seule au retour du réseau.'
    ]
  }
]
