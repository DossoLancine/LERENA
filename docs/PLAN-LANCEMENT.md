# ATTENDS — Plan de lancement en 15 phases

> Objectif : passer d'une application **utilisable en pilote (~75 %)** à un produit **commercialisable à 100 %**,
> avec un **back-office startup** pour contrôler les établissements clients et leurs utilisateurs,
> et une **prise de rendez-vous complète**.
>
> Rédigé le 1er novembre 2026. Durée totale estimée : **18 à 22 semaines** pour une personne à plein temps
> (moins avec une petite équipe : les blocs B, C et D peuvent avancer en parallèle).

---

## Vue d'ensemble

| Bloc | Phases | But | Durée |
|---|---|---|---|
| **A. Fondations** | P1 → P3 | Ne plus rien risquer : code sauvegardé, secrets protégés, environnements séparés, comptes sûrs | 3 sem. |
| **B. Communication** | P4 → P5 | SMS, e-mails, plusieurs sites par établissement | 3 sem. |
| **C. Rendez-vous** | P6 → P7 | RDV complets, du créneau à l'arrivée au guichet | 3 sem. |
| **D. Back-office startup** | P8 → P11 | Contrôler les clients, les offres, la facturation, piloter l'entreprise | 6 sem. |
| **E. Fiabilité et cadre** | P12 → P13 | Surveillance, sauvegardes testées, conformité légale | 2,5 sem. |
| **F. Lancement** | P14 → P15 | Finitions, pilote réel, mise sur le marché | 4 sem. |

Ordre conseillé : **A d'abord, sans exception**. Ensuite C et D peuvent avancer en parallèle de B.
Le pilote (P15) peut démarrer dès la fin de P7 avec un établissement accompagné, pendant que D se termine.

### Ce qui existe déjà (base de départ)

- Visiteur : application, ticket sans compte, suivi en direct, notifications push, favoris, installation PWA.
- Établissement : tableau de bord, file, guichets, accueil, agents, transferts avec parcours, priorités paramétrables,
  planning, statistiques, promotions, TV et bornes (lien d'installation sécurisé), guide d'utilisation.
- Réseau (`/org-admin`) : sites d'un groupe, rapport mensuel.
- Plateforme (`/admin`) : établissements, mise en service, réseaux, secteurs, réglages, santé, journal d'audit.
- RDV (version de base) : créneaux selon les horaires, réservation avec compte, agenda du gérant, statuts.

---

## Bloc A — Fondations

### P1 · Sauvegarde et sécurité immédiate · 1 semaine · **bloquant**

**Pourquoi** : aujourd'hui, le travail depuis la phase 2 n'existe que sur un PC et sur Vercel ; des secrets traînent dans le dépôt.

- Pousser tout l'historique sur GitHub (dépôt privé), protéger la branche `main`.
- Retirer `.env.production` du dépôt **et de l'historique**, puis **changer tous les secrets** (mot de passe base, `NEXTAUTH_SECRET`, clés VAPID, clé Supabase).
- Supprimer la clé secrète de secours écrite dans `src/lib/auth.ts` et `src/middleware.ts` : l'app refuse de démarrer sans secret.
- Couper le mode démo en production ; supprimer ou neutraliser les comptes `password123`.
- Limiter les tentatives de connexion (anti-force brute) sur `/auth` et `/pro/login`.
- En-têtes de sécurité HTTP (CSP, HSTS, X-Frame-Options sauf pages TV).

**Fini quand** : dépôt GitHub à jour, aucun secret dans le code ni l'historique, anciens secrets révoqués, mode démo désactivé en production.

### P2 · Environnements et qualité · 1 semaine

**Pourquoi** : les tests se font aujourd'hui sur la base de production (tickets de test, compteurs à remettre).

- Base **staging** séparée (projet Supabase dédié) + projet Vercel « staging » relié à une branche `staging`.
- Données de démonstration **uniquement** sur staging (scripts de seed), base de production propre.
- Intégration continue (GitHub Actions) à chaque push : vérification TypeScript, build, tests.
- Tests automatiques de bout en bout des parcours critiques : prise de ticket (appli, invité, borne, accueil), appel, transfert, priorité, appairage d'appareil, RDV.
- Procédure de mise en ligne : staging validé → production.

**Fini quand** : une modification passe par staging et les tests avant la production ; plus aucune donnée de test en production.

### P3 · Comptes et authentification · 1 semaine

- Mot de passe oublié (e-mail et, après P4, SMS) ; vérification de l'adresse e-mail des comptes professionnels.
- Mot de passe provisoire à changer à la première connexion.
- **Double authentification (2FA)** obligatoire pour super-admin et administrateurs de réseau, conseillée pour les responsables.
- Sessions : liste des appareils connectés, déconnexion à distance, expiration après inactivité pour les postes partagés (accueil, guichet).
- Règles de mot de passe et blocage temporaire après échecs répétés.

**Fini quand** : un utilisateur peut récupérer son compte seul ; aucun compte d'administration sans 2FA.

---

## Bloc B — Communication et multi-sites

### P4 · SMS, e-mails et centre de notifications · 1,5 semaine

- Fournisseur SMS ivoirien (Orange SMS API, MTN, ou agrégateur) derrière l'interface `SMS_PROVIDER` déjà prévue ; secours possible par un second fournisseur.
- Code de vérification des tickets sans compte (déjà codé, à activer).
- SMS « votre tour approche » pour les visiteurs sans application ni notification push.
- E-mails transactionnels de marque (bienvenue, mot de passe, identifiants des collaborateurs, factures) via un service d'envoi (ex. Resend).
- Préférences de notification par visiteur ; compteur d'usage SMS par établissement (servira à P9).

**Fini quand** : un invité sans smartphone est prévenu par SMS ; chaque SMS est compté par établissement.

### P5 · Plusieurs sites par établissement · 1,5 semaine

**Pourquoi** : l'application suppose encore un seul site par établissement (`branches[0]`).

- Création et gestion de plusieurs sites (agences, antennes) dans un établissement.
- Sélecteur de site pour le responsable, l'accueil et les agents ; guichets, services, horaires, appareils et files **par site**.
- TV et bornes rattachées à un site précis.
- Côté visiteur : choix du site (le plus proche en premier).
- Statistiques par site et consolidées.

**Fini quand** : une banque avec 3 agences gère ses 3 files séparément depuis un seul compte.

---

## Bloc C — Prise de rendez-vous

### P6 · RDV v2 : réserver, modifier, annuler · 1,5 semaine

- Réservation **sans compte** (prénom + téléphone, code SMS), comme le ticket invité.
- Paramètres de RDV par service (dans le tableau de bord) :
  durée du créneau, **capacité par créneau** (ex. 3 personnes en parallèle), délai minimum avant réservation,
  horizon (ex. 30 jours), nombre maximum de RDV actifs par personne.
- Jours fermés et jours fériés, fermetures exceptionnelles ; créneaux bloqués.
- Mode de réservation par service (RDV seulement, file seulement, les deux).
- Lien de gestion dans le SMS ou l'e-mail : **reporter** ou **annuler** soi-même, jusqu'à une heure limite.
- Page « Mes rendez-vous » côté visiteur.

**Fini quand** : un visiteur réserve, reporte et annule sans appeler l'établissement ; aucun créneau n'est surbooké.

### P7 · RDV v3 : du rendez-vous au guichet · 1,5 semaine

- **Arrivée** : à la borne, à l'accueil ou en scannant le QR de sa confirmation, le visiteur se signale ; un ticket est créé et **placé selon l'heure du RDV** (priorité « Rendez-vous » paramétrable), et la TV l'appelle comme les autres.
- Rappels automatiques : la veille et 2 heures avant (push ou SMS).
- **Absence (no-show)** marquée automatiquement après un délai ; historique des absences par visiteur, blocage paramétrable après N absences.
- Agenda du jour pour l'accueil et les agents : arrivés, en retard, absents.
- Agenda par agent ou par guichet ; ajout d'un RDV par l'accueil (téléphone).
- Export calendrier (.ics) pour le visiteur.
- Statistiques RDV : taux d'absence, délai moyen, remplissage des créneaux.

**Fini quand** : un patient avec RDV à 10 h arrive à 9 h 55, se signale à la borne et est appelé à l'heure, sans repasser derrière la file.

---

## Bloc D — Back-office startup (contrôle des clients et des utilisateurs)

> Espace réservé à l'équipe ATTENDS (`/admin`), étendu en véritable outil de gestion de la startup.

### P8 · Clients et comptes · 1,5 semaine

- **Fiche client** (établissement ou réseau) : coordonnées, contacts, offre, sites, appareils, usage, factures, historique, notes internes.
- **Cycle de vie** : prospect → essai → actif → impayé → suspendu → résilié ; changements tracés.
- **Suspendre / réactiver** un établissement (les visiteurs voient « service momentanément indisponible », les données sont conservées).
- **Recherche des utilisateurs** de toute la plateforme (nom, e-mail, téléphone) : rôle, établissement, dernière connexion, appareils.
- Actions sur un utilisateur : bloquer, débloquer, forcer la réinitialisation du mot de passe, révoquer les sessions, retirer d'un établissement.
- **Mode assistance** : ouvrir l'espace d'un client en lecture seule pour l'aider, avec motif obligatoire, durée limitée, inscrit au journal et visible du client.
- Rôles internes : super-admin, support (sans facturation), commercial (lecture + prospects).

**Fini quand** : l'équipe peut retrouver n'importe quel compte, le bloquer et aider un client sans connaître son mot de passe.

### P9 · Offres, limites et fonctionnalités · 1,5 semaine

- **Offres** configurables en base (pas dans le code), par exemple : Découverte (gratuit, 1 site, 2 guichets, 1 écran), Pro, Réseau, Institution (sur devis).
- **Limites par offre** : sites, guichets, appareils, utilisateurs, SMS par mois, historique conservé.
- **Fonctionnalités par offre** : RDV, borne, réseau, statistiques avancées, publicités sur TV, marque personnalisée.
- Période d'essai (ex. 30 jours) avec rappels avant la fin.
- **Compteurs d'usage** visibles par le client et par l'équipe ; alertes à 80 % et 100 %.
- Remise, prix spécial ou offre sur mesure pour un client donné.

**Fini quand** : changer l'offre d'un client active ou désactive aussitôt ses fonctionnalités et ses limites.

### P10 · Facturation et paiements · 1,5 semaine

- Paiement **Mobile Money** (Orange Money, MTN MoMo, Moov, Wave) et carte via un agrégateur local (CinetPay, PayDunya…).
- Abonnements mensuels ou annuels, renouvellement automatique ou facture à payer.
- **Factures PDF** numérotées, conformes, envoyées par e-mail et téléchargeables.
- Relances automatiques, délai de grâce, **suspension automatique** en cas d'impayé, réactivation au paiement.
- Packs de SMS prépayés.
- Institutions publiques : bon de commande et paiement par virement, sans suspension automatique.
- Espace « Abonnement » dans le tableau de bord du client.

**Fini quand** : un client choisit une offre, paie par Mobile Money et reçoit sa facture, sans intervention de l'équipe.

### P11 · Pilotage de la startup · 1,5 semaine

- Tableau de bord : revenu mensuel récurrent, nouveaux clients, résiliations, clients en essai, impayés.
- Usage de la plateforme : tickets par jour, établissements actifs, temps d'attente moyen national, appareils hors ligne.
- **Suivi de la mise en service** des nouveaux clients : étapes faites (services, guichets, équipe, appareils), clients bloqués à relancer.
- **Assistance** : demandes d'aide envoyées depuis l'app, avec capture du contexte, suivi et réponses.
- **Annonces** aux clients : bandeau dans le tableau de bord (maintenance, nouveautés), par offre ou par secteur.
- Exports pour la comptabilité.

**Fini quand** : la direction voit en un écran la santé commerciale et technique de l'entreprise.

---

## Bloc E — Fiabilité et cadre légal

### P12 · Surveillance et fiabilité · 1,5 semaine

- Suivi des erreurs (Sentry) côté navigateur et serveur, avec alertes.
- Surveillance de disponibilité (site, base, temps réel) et page de statut publique.
- Sauvegardes quotidiennes vérifiées et **restauration testée** ; plan de reprise écrit.
- Limites de débit sur les actions publiques (prise de ticket, codes SMS, connexion).
- **Test de charge** : 500 tickets par heure dans un établissement, 50 établissements actifs en même temps.
- Journaux structurés, conservation et purge.

**Fini quand** : une panne est détectée avant qu'un client appelle ; une restauration complète a été réussie au moins une fois.

### P13 · Conformité et documents légaux · 1 semaine

- Déclaration du traitement des données auprès de l'**ARTCI** (loi ivoirienne n° 2013-450).
- Conditions générales d'utilisation (visiteurs) et de vente (établissements), mentions légales.
- Politique de confidentialité, information et consentement (notifications, localisation, SMS).
- Droits des personnes : export et suppression des données à la demande, depuis le profil et le back-office.
- **Durées de conservation** et purge automatique (ex. tickets nominatifs anonymisés après 12 mois).
- Contrat de sous-traitance des données pour les établissements, surtout santé et administrations.

**Fini quand** : les documents sont en ligne, acceptés à l'inscription, et une demande de suppression est traitée en moins de 30 jours.

---

## Bloc F — Finitions et lancement

### P14 · Finitions produit · 2 semaines

- Nom de domaine (ex. **attends.ci**) et e-mails à ce nom ; marque personnalisée par établissement (logo et couleurs sur TV, borne, ticket).
- **Assistant de démarrage** dans le tableau de bord : liste d'étapes cochées automatiquement (services, guichets, équipe, appareils, affiche).
- Matériel validé : imprimante thermique de borne, modèles de TV et de clés, tablettes conseillées ; guide d'achat.
- Borne : reprise automatique après coupure réseau, file d'impression.
- Langues : français et anglais pour l'interface ; voix des annonces de meilleure qualité (synthèse vocale en ligne en option).
- Accessibilité complète (toutes les pages auditées), performances sur téléphones d'entrée de gamme et réseau 3G.
- Guide d'utilisation et vidéos courtes à jour.

**Fini quand** : un nouvel établissement s'installe seul en moins d'une heure, avec son logo sur la TV.

### P15 · Pilote, puis lancement · 2 semaines (+ 4 semaines de pilote)

- **Pilote de 4 semaines** dans 1 ou 2 établissements (une clinique, une agence), avec matériel réel, formation sur place et suivi quotidien.
- Indicateurs suivis : attente moyenne avant / après, tickets par jour, taux d'absence, satisfaction, incidents.
- Corrections issues du terrain.
- Kit commercial : démonstration, plaquette, grille tarifaire, étude de cas du pilote.
- Revue **go / no-go** : tous les critères « Fini quand » des phases 1 à 14 cochés.
- Lancement : ouverture des inscriptions, assistance renforcée les premières semaines.

**Fini quand** : le pilote montre un gain mesurable et au moins 3 établissements payants sont actifs.

---

## Calendrier indicatif

| Semaines | Phases |
|---|---|
| 1 – 3 | P1, P2, P3 (fondations) |
| 4 – 6 | P4, P5 · en parallèle P6 |
| 7 – 9 | P7 · début du **pilote** · P8 |
| 10 – 15 | P9, P10, P11 (pendant le pilote) |
| 16 – 18 | P12, P13 |
| 19 – 22 | P14, P15 · **lancement** |

## Décisions à prendre avant de commencer

1. Fournisseur SMS et agrégateur de paiement Mobile Money.
2. Grille des offres et des prix (pour P9).
3. Établissements du pilote et date de démarrage.
4. Nom de domaine.
5. Qui, dans l'équipe, aura les rôles super-admin, support et commercial.
