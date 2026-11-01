// Guide d'utilisation affiché dans Paramètres → Guide d'utilisation.
// À METTRE À JOUR à chaque évolution de l'application (nouvel écran, nouvelle étape, changement de nom).

export const GUIDE_UPDATED_AT = '1er novembre 2026'

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
    id: 'appareils',
    title: 'Appareils : la TV et la borne',
    intro: 'Deux types d’appareils peuvent être connectés, autant que vous voulez, chacun indépendamment : ils ne se connectent pas entre eux mais à l’établissement.',
    steps: [
      'Écran d’affichage : la TV de la salle d’attente. Elle montre les numéros appelés, les annonce à voix haute et peut diffuser vos vidéos. Personne ne la touche.',
      'Borne de tickets (facultative) : une tablette à l’entrée. Le visiteur touche un service et reçoit son numéro.',
      'Tablette : Paramètres → Appareils → « Afficher un QR code d’installation ». Scannez-le avec la tablette, touchez « Écran » ou « Borne ». C’est fini. Un nouveau QR code apparaît aussitôt pour l’appareil suivant.',
      'TV : ouvrez l’adresse courte indiquée dans Paramètres → Appareils dans le navigateur de la TV. Un code à 6 chiffres s’affiche : tapez-le dans Paramètres → Appareils, choisissez « Écran d’affichage », puis Connecter.',
      'Chaque appareil se connecte une seule fois : il reste connecté après une coupure de courant, tant qu’on n’efface pas les données de son navigateur.'
    ],
    tips: [
      'Sécurité : le QR code ne sert qu’une fois et expire au bout de 30 minutes. Il disparaît de la barre d’adresse dès son ouverture. Seule une empreinte chiffrée est conservée par ATTENDS.',
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
      'Ils suivent ensuite leur position en direct sur leur téléphone et sur la TV, et reçoivent une alerte quand leur tour approche.'
    ]
  },
  {
    id: 'agents',
    title: 'Au guichet et à l’accueil',
    steps: [
      'Agent : il se connecte (espace professionnel), choisit son guichet puis touche « Appeler le suivant ». Le numéro s’affiche et s’annonce sur la TV.',
      'Il peut rappeler un client, le marquer absent, le mettre en attente (document manquant) ou le transférer vers un autre service.',
      'Agent d’accueil : il crée des tickets pour les visiteurs, oriente vers le bon service et voit l’affluence de tous les guichets.',
      'Priorités : Standard, Prioritaire (personnes à mobilité réduite, femmes enceintes…) et VIP passent avant dans la file.'
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
    id: 'reseau',
    title: 'Plusieurs agences (réseau)',
    intro: 'Chaque agence est un établissement distinct : ses propres tickets, ses propres TV et bornes, son propre responsable.',
    steps: [
      'Les appareils d’une agence se connectent depuis le tableau de bord de cette agence : une TV de l’agence A n’affiche jamais les tickets de l’agence B.',
      'Le siège (administrateur du réseau) suit toutes les agences dans l’espace réseau : affluence en direct, création de nouvelles agences, rapport mensuel.'
    ]
  },
  {
    id: 'problemes',
    title: 'En cas de problème',
    steps: [
      'Une TV ou une borne affiche un vieux code, ou ne bouge plus : rechargez sa page. Les appareils se mettent aussi à jour tout seuls après chaque nouvelle version d’ATTENDS.',
      '« Code inconnu ou expiré » : le code a plus de 15 minutes ; rechargez la page sur l’appareil et tapez le nouveau code.',
      '« Lien expiré ou déjà utilisé » : affichez un nouveau QR code dans Paramètres → Appareils.',
      'Un appareil apparaît deux fois : retirez la ligne en trop.',
      'Écran « Pas de connexion » : l’appareil n’a plus internet ; la page se recharge seule au retour du réseau.'
    ]
  }
]
