# ATTENDS — Plan de finalisation du frontend

> Version 1.0 — 31 octobre 2026
> Objectif : terminer toutes les interfaces d'ATTENDS, pour chaque type d'utilisateur, avec une fluidité de niveau « Uber » et une accessibilité adaptée au service public.

---

## 1. Résumé

ATTENDS compte aujourd'hui **3 rôles** (client, agent, manager) et **1 écran public** (TV). C'est suffisant pour une clinique ou une agence isolée, pas pour une banque à 40 agences, un hôpital public avec un accueil d'orientation, ou un ministère.

Ce plan définit **9 types d'utilisateurs** : 7 personnes et 2 appareils. Pour chacun, il précise son rôle, pourquoi il existe et comment son interface doit être optimisée. Il découpe ensuite le travail restant en **6 sprints frontend (≈ 12 semaines)**.

**Principe directeur :** chaque interface est conçue pour **le contexte réel** de la personne qui l'utilise. Un client debout dans une salle d'attente avec un téléphone d'entrée de gamme en 3G n'a pas les mêmes besoins qu'un agent assis devant un écran de guichet pendant 8 heures, ou qu'une directrice régionale qui consulte ses chiffres le lundi matin.

---

## 2. État actuel

### 2.1 Ce qui est fait (phases 1 et 2)

| Domaine | Acquis |
|---|---|
| Vitesse | Serveur colocalisé avec la base, pages pré-remplies côté serveur, cache de navigation, squelettes de chargement |
| Temps réel | Supabase Realtime sur ticket, agent, tableau de bord, TV ; mise à jour en moins de 1 s |
| Écran ticket | Anneau de progression, alerte plein écran « c'est votre tour », vibration, carillon, écran maintenu allumé |
| Notifications | Web Push (téléphone verrouillé), service worker, icônes PWA |
| Interactions | Volet glissant, retours tactiles, actions agent instantanées |
| Sécurité d'accès | Contrôle strict par établissement sur toutes les actions serveur |

### 2.2 Inventaire des écrans

| Route | Utilisateur | Taille | État |
|---|---|---|---|
| `/` | Visiteur | 55 lignes | Accueil marketing basique |
| `/auth/login`, `/auth/register` | Client | 169 / 130 | Fonctionnels, sans code SMS ni mot de passe oublié |
| `/home` | Client | 213 | Rendu serveur, OK |
| `/explore` | Client | 185 | Rendu serveur + carte, OK |
| `/org/[id]` | Client | 372 | Rendu serveur, prise de ticket rapide |
| `/ticket/[id]` | Client | ~430 | Refait en phase 2 |
| `/tickets`, `/favorites`, `/profile` | Client | 109 / 140 / 168 | Fonctionnels, non retravaillés |
| `/pro/login` | Pro | 193 | Fonctionnel |
| `/agent` | Agent | ~380 | Actions instantanées, un seul mode d'écran |
| `/dashboard` | Manager | 320 + 5 onglets | Onglets sans URL ; Paramètres = 1 157 lignes |
| `/dashboard/settings` | Manager | 100 | Doublon partiel de l'onglet Paramètres |
| `/tv/[orgId]` | Écran | 819 | Fonctionnel, monolithique |

### 2.3 Manques transverses

| Manque | Conséquence |
|---|---|
| Aucune page d'erreur (`error.tsx`) ni page 404 (`not-found.tsx`) | Écran blanc ou page anglaise générique en cas de problème |
| Accessibilité quasi absente (3 attributs ARIA dans tout le code) | Inutilisable au lecteur d'écran ; non conforme aux exigences d'un marché public |
| Onglets du tableau de bord gérés en mémoire, sans URL | Pas de lien direct, bouton retour cassé, rechargement = retour à l'aperçu |
| Pas de « mot de passe oublié », pas de connexion par code SMS | Comptes perdus ; frein pour les usagers peu à l'aise avec les mots de passe |
| Prise de ticket impossible sans compte | Exclut les visiteurs pressés et les personnes sans compte |
| Français uniquement, textes écrits en dur dans le code | Impossible d'ajouter l'anglais ou les langues locales sans tout reprendre |
| Pas de mode hors ligne | Écran blanc dès que le réseau tombe, alors que la coupure est fréquente |
| Aucune bibliothèque de composants partagée | Boutons, cartes et formulaires redessinés page par page, avec des styles qui divergent |

---

## 3. Les 9 types d'utilisateurs

### 3.1 Vue d'ensemble

| # | Type | Code rôle | Appareil principal | Existe aujourd'hui |
|---|---|---|---|---|
| 1 | Visiteur | — | Téléphone | Partiellement |
| 2 | Usager (client) | `CLIENT` | Téléphone | Oui |
| 3 | Agent d'accueil (orienteur) | `RECEPTION` | Tablette ou PC à l'entrée | **Non** |
| 4 | Agent de guichet | `AGENT` | PC du guichet | Oui |
| 5 | Responsable de site | `MANAGER` | PC et téléphone | Oui |
| 6 | Administrateur d'organisation | `ORG_ADMIN` | PC | **Non** |
| 7 | Super-administrateur ATTENDS | `SUPER_ADMIN` | PC | **Non** |
| 8 | Écran de salle d'attente | appareil | TV | Oui |
| 9 | Borne d'accueil | appareil | Tablette ou borne avec imprimante | **Non** |

> Un 10ᵉ profil, **lecteur (lecture seule)**, est prévu dans le modèle de permissions pour les auditeurs et les tutelles. Il réutilise les écrans de l'administrateur d'organisation, sans aucun bouton d'action.

### 3.2 Pourquoi ces rôles et pas d'autres

- **Séparer qui sert de qui pilote.** L'agent sert, le responsable pilote un site, l'administrateur pilote un réseau. Chacun ne voit que ce qui l'aide à faire son travail.
- **Ne laisser personne de côté.** Le visiteur, l'agent d'accueil et la borne existent pour ceux qui n'ont pas de smartphone, pas de compte ou pas de connexion. C'est indispensable dans un service public.
- **Faire grandir ATTENDS.** L'administrateur d'organisation permet de vendre à des réseaux (banques, ministères). Le super-administrateur permet de gérer des centaines d'établissements sans intervenir dans la base à la main.

---

### 3.3 Visiteur (non connecté)

**Rôle :** découvrir ATTENDS et un établissement, puis prendre un ticket **sans créer de compte**.

**Pourquoi :** chaque étape avant le ticket fait perdre des usagers. Quelqu'un qui scanne le QR code affiché à l'entrée veut son ticket en 10 secondes, pas un formulaire d'inscription.

**Contexte :** debout, à l'entrée ou dans la rue, téléphone d'entrée de gamme, 3G, souvent une seule main libre.

**Interface optimisée :**
- Arrivée par QR code directement sur la fiche de l'établissement, déjà remplie par le serveur.
- Ticket « invité » : prénom et numéro de téléphone, confirmés par un code SMS à 4 chiffres. Aucun mot de passe.
- Après le ticket, proposition discrète de garder un compte : « Retrouvez vos tickets : créez un code PIN ».
- Page d'accueil `/` réécrite : ce que fait ATTENDS en 3 lignes, établissements à proximité, bouton « Scanner un QR code ».

**Écrans :** `/`, `/org/[id]`, `/ticket/[id]` (lien partageable), `/scan`.

**Indicateur de réussite :** moins de 20 s entre le scan du QR code et l'affichage du ticket.

---

### 3.4 Usager (client)

**Rôle :** prendre un ticket ou un rendez-vous, suivre sa position, être prévenu, noter le service.

**Pourquoi :** c'est la promesse d'ATTENDS, « ne perdez plus votre temps à attendre ». Si cette interface déçoit, rien d'autre ne compte.

**Contexte :** attente de 15 min à 3 h, souvent hors de l'établissement. Batterie et forfait limités. Peut être âgé, peu lettré ou malvoyant.

**Interface optimisée :**
- **Accueil** : ticket en cours en tête d'écran, avec position et attente en direct ; établissements favoris et proches.
- **Ticket** : déjà fait en phase 2. À ajouter :
  - estimation « partez maintenant » : temps de trajet comparé à l'attente restante ;
  - lecture vocale de la position (bouton haut-parleur) ;
  - mode contraste élevé.
- **Mes tickets** : en cours, à venir (rendez-vous), historique ; refaire le même ticket en un geste.
- **Rendez-vous** : créneaux réels calculés à partir des horaires et de la capacité, rappel la veille et 1 h avant, annulation en un geste.
- **Profil** : nom, téléphone, PIN, langue, taille de texte, notifications, suppression du compte (exigence ARTCI).
- Navigation par barre d'onglets en bas : Accueil, Explorer, Tickets, Favoris, Profil.
- Gros boutons (au moins 48 px), texte au moins 16 px, aucune information transmise par la seule couleur.

**Écrans :** `/home`, `/explore`, `/org/[id]`, `/ticket/[id]`, `/tickets`, `/appointments/[id]`, `/favorites`, `/profile`, `/auth/*`.

**Indicateurs de réussite :**
- 0 tour manqué chez les usagers qui ont activé les alertes ;
- note moyenne d'au moins 4,5/5 sur l'écran ticket.

---

### 3.5 Agent d'accueil (orienteur) — nouveau

**Rôle :** accueillir les personnes à l'entrée, émettre un ticket pour celles qui n'ont pas de smartphone, les orienter vers le bon service, et appliquer les priorités (femme enceinte, personne âgée, handicap, urgence).

**Pourquoi :** dans un hôpital public, une mairie ou une préfecture, une part importante du public ne prendra jamais un ticket sur son téléphone. Sans cet agent, ATTENDS ne sert qu'aux usagers connectés, et l'établissement garde deux files parallèles.

**Contexte :** debout derrière un comptoir, une personne toutes les 20 à 60 s aux heures de pointe, tablette ou PC, imprimante thermique.

**Interface optimisée :**
- **Écran unique, sans navigation** : grille de gros boutons de services, choix de priorité en un geste, champ prénom ou téléphone facultatif.
- **3 gestes maximum** par ticket : service, priorité, imprimer ou envoyer par SMS.
- Ticket imprimé avec un QR code de suivi, ou envoyé par SMS au numéro donné.
- Vue d'affluence en direct : nombre de personnes et attente par service, pour orienter (« la caisse est vide, passez d'abord »).
- Recherche d'un ticket existant, pour corriger le service ou la priorité.
- Fonctionnement en mode dégradé : les tickets sont mis en file localement si le réseau coupe, puis synchronisés.

**Écrans :** `/reception` (plein écran).

**Indicateur de réussite :** moins de 10 s pour émettre un ticket.

---

### 3.6 Agent de guichet

**Rôle :** appeler le client suivant, le servir, terminer ou marquer absent, transférer vers un autre service.

**Pourquoi :** c'est lui qui fait avancer la file. Chaque seconde perdue sur son écran se multiplie par des centaines de passages par jour.

**Contexte :** assis 6 à 8 h devant un PC, souvent avec un autre logiciel métier ouvert à côté. Il garde les yeux sur le client, pas sur l'écran.

**Interface optimisée :**
- **Raccourcis clavier** : `Espace` appelle le suivant, `S` démarre, `T` termine, `A` marque absent, `R` rappelle (annonce de nouveau le numéro sur la TV).
- **Mode compact** : une barre fine ancrée sur le côté de l'écran, utilisable à côté du logiciel métier.
- **Transfert** : envoyer le ticket vers un autre service ou guichet (hôpital : consultation → caisse → pharmacie).
- **Rappel** et **mise en attente** : le client est parti chercher un document, on le garde sans bloquer le guichet.
- Choix du guichet à la connexion, depuis une vraie liste au lieu d'un texte libre.
- Chronomètre du passage en cours, et alerte discrète au-delà de la durée moyenne.
- Notes internes sur le ticket, visibles des autres agents en cas de transfert.
- Thème sombre disponible, pour limiter la fatigue visuelle.

**Écrans :** `/agent`, `/agent/compact`.

**Indicateur de réussite :** moins de 2 s entre la fin d'un passage et l'appel du suivant.

---

### 3.7 Responsable de site (manager)

**Rôle :** piloter **un** site : ouvrir et fermer, suivre la file en direct, affecter les agents aux guichets, gérer les services, horaires, rendez-vous et promotions, régler l'écran TV.

**Pourquoi :** il réagit en temps réel (« la file Pédiatrie dépasse 25 min, j'ouvre un 2ᵉ guichet ») et fait évoluer l'organisation du site semaine après semaine.

**Contexte :** bureau sur PC, mais aussi en déplacement dans l'établissement, téléphone à la main.

**Interface optimisée :**
- **Onglets transformés en vraies pages**, avec leur URL : `/dashboard/queue`, `/dashboard/agenda`, `/dashboard/services`, `/dashboard/team`, `/dashboard/analytics`, `/dashboard/promotions`, `/dashboard/settings/*`. Lien direct, retour arrière et rechargement fonctionnent.
- **Vue d'ensemble** : attente par service, guichets ouverts et agent affecté, alertes avec action en un geste (« ouvrir le guichet 4 »).
- **Paramètres** découpés en sous-pages : établissement, horaires, files et guichets, équipe, écran TV, QR code et affiche, données et export. Aujourd'hui, ce n'est qu'un seul fichier de 1 157 lignes.
- **Planning des agents** : qui tient quel guichet, et quand.
- Version **téléphone** du tableau de bord : indicateurs clés et alertes, sans les écrans de configuration.
- Statistiques avec filtres de période, comparaison à la semaine précédente, export PDF et CSV.

**Écrans :** `/dashboard/*`.

**Indicateur de réussite :** une alerte d'attente traitée en moins de 2 min.

---

### 3.8 Administrateur d'organisation — nouveau

**Rôle :** piloter **plusieurs sites** de la même organisation (réseau bancaire, groupe hospitalier, direction régionale d'un ministère). Il crée les sites et nomme leurs responsables, fixe les règles communes (services types, priorités, quotas), et compare les performances entre sites.

**Pourquoi :** une banque à 40 agences ou un ministère n'achète pas 40 comptes séparés. Il lui faut une vue consolidée et un contrôle central. C'est la condition pour signer des contrats « Entreprise » et « Institution ».

**Contexte :** siège ou direction, PC, consultation hebdomadaire, rapports à transmettre à la hiérarchie.

**Interface optimisée :**
- **Carte et classement des sites** : attente moyenne, abandons, satisfaction, avec un code couleur par seuil.
- **Comparaison** entre sites et dans le temps.
- **Modèles** : services types, priorités et quotas définis une fois, appliqués à tous les sites ou à une sélection.
- **Utilisateurs** : création des responsables de site et des lecteurs, réinitialisation des accès.
- **Rapports** mensuels automatiques par e-mail (PDF).
- **Image de marque** : logo et couleurs sur la fiche, le ticket et la TV.
- **Abonnement et factures** (phase commerciale).

**Écrans :** `/org-admin`, `/org-admin/sites`, `/org-admin/sites/[id]`, `/org-admin/templates`, `/org-admin/users`, `/org-admin/reports`, `/org-admin/branding`, `/org-admin/billing`.

**Indicateur de réussite :** rapport mensuel produit sans aucune intervention manuelle.

---

### 3.9 Super-administrateur ATTENDS — nouveau

**Rôle :** équipe ATTENDS. Elle inscrit de nouveaux établissements, gère les abonnements, aide un client en cas de problème, surveille la santé de la plateforme.

**Pourquoi :** aujourd'hui, créer un établissement passe par un script lancé à la main (`scripts/create-demo-orgs.js`). Ça ne tient pas au-delà de quelques clients.

**Contexte :** équipe interne, PC, accès sensible.

**Interface optimisée :**
- **Liste des organisations** : statut, offre, nombre de sites, activité des 7 derniers jours.
- **Assistant d'inscription** : organisation, puis premier site, puis services à partir d'un modèle sectoriel, puis responsable invité par e-mail ou SMS.
- **Mode assistance** : voir l'interface d'un client en lecture seule, avec un bandeau visible et une trace dans le journal d'audit.
- **Santé de la plateforme** : erreurs, latence, connexions temps réel, SMS et notifications envoyés.
- **Journal d'audit** consultable.
- Double authentification obligatoire.

**Écrans :** `/admin/*`, sur un sous-domaine séparé à terme.

**Indicateur de réussite :** un nouvel établissement opérationnel en moins de 15 min.

---

### 3.10 Écran de salle d'attente (appareil)

**Rôle :** afficher les numéros appelés et le guichet, annoncer l'appel par la voix, diffuser des contenus entre deux appels.

**Pourquoi :** c'est le lien entre le guichet et les personnes présentes, y compris celles qui n'ont pas de téléphone.

**Contexte :** TV à 3–5 m des personnes assises, allumée 10 h par jour, lisible par tous, réseau parfois instable.

**Interface optimisée :**
- **Appairage par code** : la TV affiche un code à 6 chiffres, le responsable le saisit. Plus besoin de taper une URL avec un identifiant.
- **Annonce vocale** : « Ticket P 0 0 2, guichet 3 », en français, puis en dioula et en baoulé.
- Numéros d'au moins 120 px, fort contraste, rien d'important en bas de l'écran (souvent masqué par les têtes).
- Historique des 5 derniers appels, pour ceux qui ont manqué l'annonce.
- **Résilience** : reconnexion automatique, dernier état conservé si le réseau coupe, indicateur discret « hors ligne ».
- Découpage du fichier actuel (819 lignes) en composants : file, appel, lecteur vidéo, bandeau promotions.

**Écrans :** `/tv/pair`, `/tv/[deviceId]`.

**Indicateur de réussite :** affichage moins de 1 s après le clic de l'agent, et 0 écran noir sur une journée.

---

### 3.11 Borne d'accueil (appareil) — nouveau

**Rôle :** émettre un ticket papier en libre-service, sans agent.

**Pourquoi :** elle complète l'agent d'accueil aux heures de pointe, et le remplace dans les petits sites.

**Contexte :** tablette sur pied, utilisée debout par des inconnus, parfois peu lettrés.

**Interface optimisée :**
- Écran d'attente avec « Touchez pour prendre un ticket » et une animation douce.
- **Pictogrammes et texte** pour chaque service, lecture vocale à la demande.
- 3 écrans maximum : service, priorité, ticket imprimé (ou envoyé par SMS).
- Retour automatique à l'accueil après 30 s d'inactivité.
- Mode kiosque : plein écran, aucune sortie possible sans code responsable.
- File locale si le réseau coupe.

**Écrans :** `/kiosk/pair`, `/kiosk/[deviceId]`.

**Indicateur de réussite :** moins de 15 s par ticket, avec un taux d'abandon devant la borne inférieur à 5 %.

---

## 4. Matrice des permissions

Légende : ✅ complet · 👁 lecture · 🔸 son périmètre seulement · — aucun accès

| Action | Visiteur | Usager | Accueil | Agent | Resp. site | Admin org. | Lecteur | Super-admin |
|---|---|---|---|---|---|---|---|---|
| Voir établissements et attentes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prendre un ticket pour soi | ✅ (invité) | ✅ | — | — | — | — | — | — |
| Émettre un ticket pour un tiers | — | — | 🔸 site | 🔸 site | 🔸 site | — | — | — |
| Appeler, servir, transférer | — | — | — | 🔸 guichet | 🔸 site | — | — | — |
| Ouvrir ou fermer le site | — | — | — | — | 🔸 site | 🔸 org. | — | ✅ |
| Gérer services, horaires, guichets | — | — | — | — | 🔸 site | 🔸 org. | — | ✅ |
| Gérer l'équipe d'un site | — | — | — | — | 🔸 site | 🔸 org. | — | ✅ |
| Créer des sites, des modèles | — | — | — | — | — | 🔸 org. | — | ✅ |
| Statistiques | — | — | 👁 jour | 👁 soi | 🔸 site | 🔸 org. | 👁 org. | ✅ |
| Export de données | — | — | — | — | 🔸 site | 🔸 org. | 👁 org. | ✅ |
| Abonnement et facturation | — | — | — | — | — | 🔸 org. | — | ✅ |
| Créer une organisation | — | — | — | — | — | — | — | ✅ |
| Mode assistance | — | — | — | — | — | — | — | ✅ (tracé) |

---

## 5. Arborescence cible

```
/                         Accueil public
/scan                     Scanner un QR code
/auth/login               Connexion usager (téléphone + PIN ou code SMS)
/auth/register            Inscription usager
/auth/reset               Mot de passe ou PIN oublié
/home                     Accueil usager
/explore                  Recherche et carte
/org/[id]                 Fiche établissement, ticket, rendez-vous
/ticket/[id]              Suivi du ticket (partageable)
/tickets                  Mes tickets et rendez-vous
/appointments/[id]        Détail d'un rendez-vous
/favorites                Favoris
/profile                  Profil, langue, accessibilité, notifications

/pro/login                Connexion professionnelle
/reception                Agent d'accueil
/agent                    Agent de guichet
/agent/compact            Barre latérale compacte
/dashboard                Responsable de site : vue d'ensemble
/dashboard/queue | agenda | services | counters | team | schedule | analytics | promotions
/dashboard/settings/{site,hours,tv,poster,data}
/org-admin                Administrateur d'organisation
/org-admin/{sites,sites/[id],templates,users,reports,branding,billing}
/admin                    Super-administrateur
/admin/{organizations,organizations/[id],onboarding,health,audit}

/tv/pair  · /tv/[deviceId]          Écran de salle d'attente
/kiosk/pair · /kiosk/[deviceId]     Borne d'accueil
```

---

## 6. Principes d'interface « fluidité Uber »

### 6.1 Budget de performance (vérifié à chaque déploiement)

| Mesure | Cible | Comment |
|---|---|---|
| Premier affichage utile (LCP) en 3G | < 2,0 s | Rendu serveur, images optimisées, polices locales |
| Réaction à un appui (INP) | < 200 ms | Mises à jour optimistes, aucun calcul lourd dans le navigateur |
| JavaScript par page | < 150 Ko | Chargement à la demande de la carte, des graphiques et des éditeurs |
| Décalage visuel (CLS) | < 0,05 | Squelettes à la taille exacte du contenu final |
| Mise à jour temps réel | < 1 s | Supabase Realtime (déjà en place) |

### 6.2 Règles de conception

1. **Jamais d'écran vide** : squelette, dernière donnée connue ou état « vide » explicatif, avec une action proposée.
2. **Toute action répond tout de suite** : l'écran change dès l'appui, le serveur confirme ensuite, l'erreur est annoncée clairement si elle survient.
3. **Le mouvement explique** : les volets montent d'où vient le geste, les chiffres s'animent quand ils changent. Pas d'animation décorative, et le réglage « réduire les animations » du système est respecté.
4. **Une seule action principale par écran**, toujours au même endroit : bas de l'écran sur téléphone, à portée du pouce.
5. **Lisible pour tous** : texte d'au moins 16 px, contraste AA au minimum, cibles d'au moins 48 px, aucune information transmise par la seule couleur.
6. **Conçu pour le réseau réel** : fonctionne en 3G, garde l'écran utile hors ligne, réessaie tout seul.

### 6.3 Système de design (à créer en premier)

Composants partagés dans `src/components/ui/` : `Button`, `IconButton`, `Card`, `Badge`, `Input`, `PhoneInput`, `PinInput`, `Select`, `Tabs`, `BottomSheet` (fait), `Dialog`, `Toast`, `Skeleton` (fait), `EmptyState`, `StatCard`, `DataTable`, `NavBar`, `TopBar`.

Jetons de design définis une fois dans `tailwind.config.js` :
- couleurs orange, gris et états (succès, alerte, erreur, info), y compris le thème sombre ;
- espacements, rayons, ombres, tailles de texte.

Chaque composant est documenté avec ses variantes et testé au clavier et au lecteur d'écran.

---

## 7. Chantiers transverses

| Chantier | Contenu |
|---|---|
| **Erreurs et 404** | `error.tsx`, `not-found.tsx`, `global-error.tsx` en français, avec bouton « Réessayer » et retour à l'accueil |
| **Accessibilité** | Libellés ARIA, ordre de navigation au clavier, focus visible, annonces des changements de position au lecteur d'écran, audit axe sans erreur |
| **Langues** | Extraction de tous les textes dans `messages/fr.json`, puis `en.json` ; langues locales pour la TV et la borne (voix) |
| **Hors ligne** | Service worker avec page hors ligne, dernier ticket consultable sans réseau, file locale pour l'accueil et la borne |
| **Authentification** | Code SMS (OTP), PIN à 4 chiffres, mot de passe oublié, double authentification pour l'administration |
| **Mesure** | Suivi des Web Vitals réels (Vercel Speed Insights), remontée des erreurs (Sentry) |
| **Tests** | Tests de bout en bout (Playwright) sur les parcours clés : prendre un ticket, appeler, terminer, recevoir l'alerte |

---

## 8. Plan de réalisation (6 sprints de 2 semaines)

### Sprint F1 — Fondations
- Système de design : composants partagés et jetons.
- Pages d'erreur et 404.
- Extraction des textes vers les fichiers de langue (français).
- Tableau de bord : onglets transformés en vraies pages avec URL.
- Découpage de l'onglet Paramètres (1 157 lignes) en sous-pages.

**Terminé quand :** aucune page n'utilise plus de boutons ou de cartes redessinés à la main, et chaque onglet du tableau de bord a son URL.

### Sprint F2 — Usager et visiteur
- Ticket invité avec code SMS, `/scan`, nouvelle page d'accueil.
- Connexion par PIN, mot de passe oublié.
- Refonte de « Mes tickets », du profil (langue, taille de texte, contraste) et des rendez-vous (créneaux réels, rappels).
- Estimation « partez maintenant », lecture vocale de la position.

**Terminé quand :** un visiteur obtient un ticket en moins de 20 s depuis un QR code.

### Sprint F3 — Guichet et accueil
- Interface agent : raccourcis clavier, mode compact, transfert, rappel, mise en attente, notes, chronomètre, thème sombre.
- Nouvelle interface `/reception` avec impression de ticket.
- Prérequis serveur : table des guichets, rôle `RECEPTION`, transfert de ticket (voir section 9).

**Terminé quand :** l'accueil émet un ticket en moins de 10 s, et un agent enchaîne deux passages en moins de 2 s.

### Sprint F4 — Responsable de site
- Vue d'ensemble avec actions directes sur les alertes.
- Gestion des guichets et planning des agents.
- Statistiques avec filtres, comparaison et export PDF.
- Version téléphone du tableau de bord.

**Terminé quand :** une alerte d'attente se traite en moins de 2 min, depuis un téléphone.

### Sprint F5 — Écrans publics
- TV : appairage par code, annonce vocale, historique des appels, résilience, découpage du code.
- Borne : parcours en 3 écrans, impression, mode kiosque, file hors ligne.

**Terminé quand :** une journée complète de test se passe sans écran noir, et un ticket se prend en moins de 15 s à la borne.

### Sprint F6 — Réseaux et plateforme
- Interface administrateur d'organisation : sites, comparaison, modèles, utilisateurs, rapports, image de marque.
- Interface super-administrateur : organisations, assistant d'inscription, assistance, santé, audit.
- Rôle lecteur.
- Audit d'accessibilité complet et tests de bout en bout.

**Terminé quand :** un nouvel établissement est opérationnel en moins de 15 min depuis `/admin`, sans aucun script.

---

## 9. Ce que le backend doit fournir au frontend

Ces changements sont nécessaires avant les sprints concernés.

| Besoin | Changement | Sprint |
|---|---|---|
| Nouveaux rôles | Liste fixe `Role` : `CLIENT`, `RECEPTION`, `AGENT`, `MANAGER`, `ORG_ADMIN`, `VIEWER`, `SUPER_ADMIN` | F3 |
| Responsable limité à un site | `OrganizationMember.branchId` (vide = toute l'organisation) | F4 |
| Vrais guichets | Table `Counter` (site, nom, services servis, agent actuel), qui remplace le guichet stocké dans `guestPhone` | F3 |
| Transfert et parcours | `TicketStep` : historique des étapes et des services d'un ticket | F3 |
| Appareils | Table `Device` (TV ou borne, site, code d'appairage, dernier signe de vie) | F5 |
| Ticket invité | Code SMS (fournisseur local : Orange, MTN, Moov ou un agrégateur) et limite de tickets par numéro | F2 |
| Créneaux réels | Calcul à partir de `BusinessHour` et de la capacité par service | F2 |
| Organisations imbriquées | `Organization.parentId`, statistiques consolidées | F6 |
| Journal d'audit | Table `AuditLog` (qui, quoi, quand, sur quoi) | F6 |

---

## 10. Définition de « terminé » pour chaque écran

Un écran n'est livré que si tous ces points sont vrais :

- [ ] Rendu correct sur un téléphone de 360 px de large et sur un PC.
- [ ] Squelette pendant le chargement, état vide et état d'erreur prévus.
- [ ] Budget de performance respecté (section 6.1).
- [ ] Utilisable entièrement au clavier, avec des libellés lisibles au lecteur d'écran.
- [ ] Aucun texte écrit en dur dans le code : tout passe par les fichiers de langue.
- [ ] Toutes les données passent par une action serveur qui vérifie le rôle et le périmètre.
- [ ] Testé sur réseau 3G simulé et en coupure réseau.
- [ ] Parcours principal couvert par un test de bout en bout.

---

## 11. Calendrier

| Semaines | Sprint | Livrable visible |
|---|---|---|
| 1–2 | F1 Fondations | Composants unifiés, tableau de bord avec URL, pages d'erreur |
| 3–4 | F2 Usager | Ticket invité par QR code et SMS, profil accessible, rendez-vous réels |
| 5–6 | F3 Guichet et accueil | Interface `/reception`, agent au clavier, guichets réels |
| 7–8 | F4 Responsable de site | Pilotage en direct, planning, version téléphone |
| 9–10 | F5 Écrans publics | TV appairée et parlante, borne en libre-service |
| 11–12 | F6 Réseaux et plateforme | Espace administrateur d'organisation et super-administrateur |

**Estimation :** 12 semaines pour 1 développeur frontend à temps plein, plus le backend de la section 9 en parallèle. À 2 développeurs, 7 à 8 semaines.
