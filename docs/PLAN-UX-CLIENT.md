# Plan UX — espace client Lerena

Objectif : étendre à **toute** l’interface du visiteur la logique du nouvel accueil (action immédiate, attente en direct, fluidité d’app native, effet « waouh » à chaque retour) avec une identité visuelle **propre à Lerena**, qui ne ressemble à aucun gabarit générique.

---

## 0. Principes directeurs

| Principe | Concrètement |
|---|---|
| **Une action évidente par écran** | Un seul bouton principal, toujours au même endroit (bas de l’écran, à portée du pouce) |
| **Le temps réel comme signature** | Chaque écran montre quelque chose de vivant : attente, place, affluence, compte à rebours |
| **Zéro attente perçue** | Squelettes à la forme exacte du contenu, actions optimistes, préchargement des pages probables |
| **Continuité** | La carte touchée « devient » la page suivante (transition d’élément partagé), la barre du bas ne bouge jamais |
| **Pensé pour Abidjan** | Téléphones Android d’entrée de gamme, 3G instable, soleil sur l’écran, une main occupée |
| **Identité humaine** | Illustrations et photos réelles, voix éditoriale, détails dessinés : rien de « par défaut » |

### Objectifs mesurés

| Indicateur | Cible |
|---|---|
| Temps pour obtenir un ticket depuis l’accueil | < 15 s, 3 touches maximum |
| Chargement (LCP) sur Android d’entrée de gamme en 3G | < 2,5 s |
| Réactivité (INP) | < 200 ms |
| Stabilité visuelle (CLS) | < 0,05 |
| Satisfaction (étoiles après passage) | ≥ 4,5 / 5 |
| Retour dans l’app sous 30 jours | > 40 % des visiteurs avec compte |

---

## 1. Identité « non générique » (le chantier qui évite l’effet IA)

Ce qui trahit une interface générée : police par défaut partout, émojis dans les titres, icônes de bibliothèque sans retouche, dégradés orange « standard », textes passe-partout, mélange de styles d’un écran à l’autre. Correctifs :

1. **Typographie de marque** : une police d’affichage à caractère pour les titres et les numéros de ticket (ex. *Bricolage Grotesque* ou *Clash Display*), le texte courant reste très lisible. Les numéros de ticket ont un traitement unique (chiffres tabulaires, grande taille, encoche).
2. **Motif signature** : l’**encoche de ticket** (demi-cercles découpés) et la **ligne de file** (points qui avancent) déclinés sur les cartes, les séparateurs, les chargements, l’écran « c’est votre tour ».
3. **Illustrations sur mesure** : 12 scènes dessinées dans un seul style (deux tons, orange Lerena + encre), situées en Côte d’Ivoire : salle d’attente d’hôpital, guichet de mairie, agence bancaire, pharmacie, file au soleil… Utilisées pour les états vides, les erreurs, l’accueil, l’intégration. À commander à un illustrateur (≈ 2 semaines).
4. **Photos réelles** : chaque établissement du pilote photographié (façade, accueil) ; photo de couverture sur sa fiche. Pas de banque d’images.
5. **Icônes retouchées** : jeu de base harmonisé (épaisseur, coins), 10 icônes métier dessinées (ticket, guichet, file, borne…).
6. **Voix éditoriale** : vouvoiement chaleureux, phrases courtes, vocabulaire local (« guichet », « passer », « on vous appelle »), pas d’émojis dans l’interface, pas de formules creuses. Guide de rédaction + relecture de tous les textes.
7. **Cohérence stricte** : un seul jeu de couleurs (fin des `orange-500`, `gray-100` hérités), rayons, ombres et espacements définis une fois ; revue écran par écran.
8. **Son et vibration** : un son court et propre à Lerena pour « bientôt votre tour » et « c’est votre tour », vibration distinctive.

**Livrable** : charte UI (couleurs, typo, motif, illustrations, ton) + bibliothèque de composants mise à jour.

---

## 2. Parcours et écrans

### U1 · Fiche établissement (`/org/[id]`)
- Couverture : photo réelle ou illustration du secteur, logo en médaillon, transition partagée depuis la carte de l’accueil.
- **Affluence du jour** : courbe par heure calculée sur les vrais tickets (« Calme vers 14 h ») et le **meilleur moment pour venir**.
- Services en cartes avec attente en direct ; choix du service dans une **feuille glissante** ; bouton fixe « Prendre un ticket » en bas.
- Horaires, itinéraire, appel, partage, favori : rangée d’actions rondes.

### U2 · Ticket en direct (`/ticket/[id]`) — l’écran roi
- Numéro géant avec l’encoche, anneau de progression, **place qui s’anime** à chaque avancée, attente estimée qui se met à jour.
- Carte « **Partez maintenant** » calculée avec la distance et l’attente.
- Écran plein « **C’est votre tour** » : couleur, son, vibration, guichet en très grand.
- Mode luminosité forte (lisible au soleil), écran maintenu allumé quand le tour approche.
- Après le passage : notation en une touche (étoiles), merci illustré.

### U3 · Explorer (`/explore`)
- Carte plein écran + liste en **feuille glissante** (trois hauteurs), comme les apps de transport.
- Filtres en puces fixes (secteur, ouvert, attente < 15 min, distance), recherche avec suggestions et recherches récentes.
- Marqueurs de carte colorés selon l’attente (vert / orange / rouge).

### U4 · Prise de ticket et de rendez-vous
- Sans compte : prénom + téléphone sur un seul écran, code SMS saisi automatiquement si le téléphone le permet.
- Rendez-vous : calendrier horizontal par jour, créneaux en grille, confirmation animée avec ajout à l’agenda.
- Confirmation : le ticket « s’imprime » à l’écran (animation de sortie de ticket), puis bascule sur le suivi.

### U5 · Mes tickets (`/tickets`)
- En cours en haut (carte vivante) ; historique en **frise par jour** ; rendez-vous à venir avec compte à rebours.
- États vides illustrés avec une action (« Trouver un établissement »).

### U6 · Favoris (`/favorites`)
- Cartes avec attente en direct et bouton « Prendre un ticket » direct ; tri par attente.
- Alerte facultative « Prévenez-moi quand l’attente passe sous 10 min ».

### U7 · Profil (`/profile`)
- Liste de réglages façon iOS : identité, notifications, langue, sécurité, aide, confidentialité, déconnexion, suppression du compte.
- **Pas de bouton d’export** : une ligne « Demander une copie de mes données » ouvre un e-mail / formulaire vers l’équipe Lerena, qui répond sous 30 jours avec l’export de la console (obligation légale maintenue, sans export libre-service).
- Statistiques personnelles : « Temps gagné hors de la file » (cumul), nombre de passages.

### U8 · Connexion, inscription, scan
- Téléphone d’abord, code PIN, une seule page d’inscription, connexion mémorisée.
- Scan : caméra plein écran, cadre animé, retour haptique à la détection, lampe torche.
- Hors ligne : écran illustré, dernier ticket consultable sans réseau.

---

## 3. Fluidité technique (sur tout l’espace client)

1. **Transitions d’éléments partagés** (View Transitions) : carte → fiche, ticket → suivi ; fondu de repli sur les navigateurs anciens.
2. **Feuilles glissantes** natives (geste, inertie, poignée) pour tous les choix : service, filtres, partage.
3. **Squelettes** identiques à chaque mise en page ; aucun saut à l’arrivée des données.
4. **Actions optimistes** : favori, notation, annulation s’affichent avant la réponse du serveur.
5. **Préchargement** des pages probables (fiche touchée, suivi après prise de ticket).
6. **Images** : logos et photos servis en WebP, tailles adaptées, chargement différé.
7. **Hors ligne** : mise en cache des écrans visités et du dernier ticket.
8. **Accessibilité** : contrastes AA, cibles de 44 px, lecteur d’écran, réduction des animations respectée.

---

## 4. Méthode et calendrier (≈ 6 semaines)

| Semaine | Travail |
|---|---|
| 1 | Charte UI, motif, typo, guide de rédaction ; commande des illustrations ; photos des établissements pilotes |
| 2 | Bibliothèque de composants (feuille glissante, transitions, squelettes, cartes, ticket) |
| 3 | U2 Ticket en direct + U4 Prise de ticket (le cœur de l’expérience) |
| 4 | U1 Fiche + U3 Explorer |
| 5 | U5 Mes tickets, U6 Favoris, U7 Profil, U8 Connexion / scan ; intégration des illustrations |
| 6 | Tests avec 5 visiteurs réels par profil (jeune actif, personne âgée, parent) à Abidjan, sur Android d’entrée de gamme ; corrections ; mesures de performance |

**Critères de fin** : objectifs du §0 atteints, aucun écran hors charte, tests utilisateurs sans blocage, textes relus.

---

## 5. Décisions à prendre

1. Police d’affichage (2 propositions à comparer sur maquettes).
2. Illustrateur (budget ≈ 12 scènes) et séance photo pendant le pilote.
3. Son de notification Lerena (création ou banque sonore libre de droits).
4. Validation de la suppression de l’export libre-service au profit de la demande par e-mail.
