# Plan — CRM des visiteurs (pour les établissements)

**Objectif** : que chaque établissement connaisse, suive et fidélise ses visiteurs sans cahier ni tableur, avec des fonctions qui règlent ses problèmes de tous les jours (reconnaître un habitué, éviter les absences, rappeler un suivi) et ceux qui reviennent chaque mois (relancer, informer, mesurer et corriger la satisfaction).

**Pour qui** : le responsable (pilotage), l’accueil (contact direct), les agents de guichet (contexte au moment de l’appel).

---

## 1. Les douleurs traitées

| # | Douleur du terrain | Fréquence | Réponse Lerena | Étape |
|---|---|---|---|---|
| 1 | « On redemande tout à chaque visite, on ne reconnaît pas les habitués » | Chaque jour | Fiche visiteur créée et mise à jour toute seule à chaque ticket et rendez-vous | C1 |
| 2 | « Besoins particuliers oubliés (fauteuil, interprète, personne âgée) » | Chaque jour | Étiquettes visibles par l’accueil et le guichet au moment de l’appel | C1 |
| 3 | « Retrouver quand quelqu’un est venu et pour quoi » | Chaque jour | Historique complet : tickets, rendez-vous, services, attentes, notes | C1 |
| 4 | « Les patients ne reviennent pas pour leur contrôle » | Chaque semaine | Suivis datés (« rappeler dans 3 mois ») + liste du jour + SMS de rappel | C2 |
| 5 | « Trop de rendez-vous non honorés » | Chaque jour | Absents répétés repérés, relance automatique pour reprogrammer, blocage optionnel | C2 |
| 6 | « Ressaisir les rendez-vous réguliers (dialyse, grossesse, kiné) » | Chaque semaine | Rendez-vous récurrents créés en une fois | C2 |
| 7 | « Prévenir tout le monde prend une journée (fermeture, campagne, documents prêts) » | Chaque mois | SMS ciblés par segment ou étiquette, modèles, envoi programmé | C3 |
| 8 | « Messages envoyés à des gens qui ne veulent plus en recevoir » | Chaque mois | Consentement enregistré, désinscription « STOP » respectée automatiquement | C3 |
| 9 | « On ne sait pas qui est mécontent, ni pourquoi » | Chaque semaine | Avis négatifs → boîte « À traiter », réponse, clôture avec motif | C4 |
| 10 | « Impossible de savoir si l’on fidélise ou si l’on perd du monde » | Chaque mois | Tableau de bord : nouveaux, fidèles, perdus, satisfaction, évolution | C5 |
| 11 | « Nos listes Excel sont éparpillées et pleines de doublons » | Au démarrage | Import CSV guidé, détection et fusion des doublons | C5 |

---

## 2. Étapes détaillées

### C1 · Fichier visiteurs — *1,5 semaine*

**Ce qui est livré**
- **Fiche unique** par visiteur et par établissement, reconnue par son numéro de téléphone (ou son compte Lerena). Un même visiteur a une fiche distincte dans chaque établissement : chaque établissement ne voit que ses propres visiteurs.
- **Alimentation automatique** : chaque ticket (application, borne, accueil, QR code), rendez-vous et arrivée met la fiche à jour. Reprise de tout l’historique existant au lancement.
- **Page « Visiteurs »** dans le menu du tableau de bord :
  - recherche par nom ou numéro ;
  - **segments prêts à l’emploi** : Tous · Nouveaux (1er passage < 30 jours) · Habitués (3 passages et plus) · À relancer (pas venu depuis 90 jours) · Absents répétés (2 absences et plus) · Mécontents (note ≤ 2) · par étiquette ;
  - compteur par segment, tri (dernier passage, nombre de passages, absences).
- **Fiche visiteur** :
  - en-tête : nom, numéro, étiquettes, consentement aux messages ;
  - chiffres : passages, absences, rendez-vous à venir, note moyenne, premier et dernier passage ;
  - **frise d’historique** : tickets et rendez-vous mêlés, avec service, guichet, attente, statut ;
  - **notes internes** datées et signées (avec rappel : pas d’information médicale) ;
  - actions en un geste : **Appeler**, **WhatsApp**, **Prendre un rendez-vous** pour lui, modifier le nom.
- **Étiquettes** libres, créées par l’établissement (« Fauteuil roulant », « Interprète », « Suivi grossesse », « VIP »…), avec couleur.
- **Au guichet et à l’accueil** : quand un ticket est appelé, les étiquettes du visiteur s’affichent à l’agent (ex. « Fauteuil roulant »).

**Fini quand** : un visiteur venu 3 fois est reconnu à son 4e passage, avec son historique et ses étiquettes visibles par l’accueil.

### C2 · Suivis, absences et récurrences — *1,5 semaine*

- **Suivis datés** depuis la fiche : « Rappeler pour le contrôle » le 15 février, assigné à un membre de l’équipe.
- **« À faire aujourd’hui »** : liste des suivis du jour et en retard, dans le tableau de bord et à l’accueil ; cocher comme fait.
- **Rappel SMS au visiteur** (facultatif par suivi) : « Votre contrôle approche, réservez votre créneau : lien ».
- **Rendez-vous récurrents** : chaque semaine / toutes les 2 semaines / chaque mois, N fois ; tous les créneaux réservés d’un coup, rappels inclus.
- **Absences** : au 1er rendez-vous manqué, SMS automatique proposant de reprogrammer (lien) ; au seuil réglé, réservation en ligne bloquée (déjà en place) et étiquette « Absences répétées ».

**Fini quand** : un suivi créé il y a 3 mois apparaît le bon jour dans « À faire aujourd’hui » et le visiteur a reçu son rappel.

### C3 · Messages et campagnes — *2 semaines*

- **SMS individuel** depuis la fiche (texte libre ou modèle).
- **Campagnes** vers un segment, une étiquette ou une sélection :
  - modèles avec variables : {prénom}, {établissement}, {date}, {service}, {lien} ;
  - aperçu, nombre de destinataires et **coût estimé en SMS** avant envoi ;
  - envoi immédiat ou **programmé** (date et heure) ;
  - suivi : envoyés, échecs, désinscriptions.
- **Modèles prêts à l’emploi** : fermeture exceptionnelle, documents prêts, campagne de vaccination, rappel de renouvellement, nouveau service.
- **Consentement** : les messages non liés à un ticket ou un rendez-vous ne partent qu’aux visiteurs ayant accepté (case dans l’application, à l’accueil ou à l’import) ; chaque SMS de campagne se termine par « STOP au … » et la désinscription est appliquée automatiquement.
- Décompte sur les SMS inclus du forfait, puis sur les packs (boutique).

**Fini quand** : une campagne vers « Habitués » est programmée, partie à l’heure, sans aucun envoi aux visiteurs désinscrits.

### C4 · Satisfaction et réclamations — *1 semaine*

- Après chaque passage, la note (déjà collectée) peut être complétée d’un **commentaire**.
- Note ≤ 2 ou commentaire négatif → **boîte « À traiter »** avec pastille dans le menu.
- Traitement : appeler / répondre par SMS depuis la réclamation, ajouter une note, **clôturer avec un motif** (attente, accueil, erreur, autre).
- Statistiques : satisfaction par service, par guichet et par semaine ; motifs les plus fréquents.

**Fini quand** : un avis à 1 étoile est traité et clôturé en moins de 48 h, avec son motif comptabilisé.

### C5 · Pilotage et qualité des données — *1 semaine*

- **Tableau de bord CRM** : visiteurs actifs, nouveaux du mois, taux de retour, visiteurs perdus (> 90 jours), absences, satisfaction ; évolution sur 6 mois ; segments à surveiller.
- **Import CSV** guidé (colonnes reconnues, aperçu, doublons signalés, consentement à préciser).
- **Doublons** : détection (même numéro, noms proches) et **fusion** de deux fiches avec tout leur historique.
- **Export** réservé au responsable, tracé dans le journal (le visiteur lui-même n’exporte pas : il demande une copie).

**Fini quand** : un fichier Excel de 500 contacts est importé sans doublon et le tableau de bord du mois s’affiche.

---

## 3. Données (vue d’ensemble)

| Élément | Contenu |
|---|---|
| Visiteur | établissement, téléphone, nom, compte lié, étiquettes, consentement (date, canal), premier / dernier passage |
| Note | visiteur, auteur, texte, date |
| Étiquette | établissement, nom, couleur |
| Suivi | visiteur, date, objet, assigné à, rappel SMS, statut |
| Campagne | message, cible, programmation, compteurs |
| Réclamation | ticket, note, commentaire, statut, motif, réponse |

Les tickets et rendez-vous existants sont rattachés à la fiche du visiteur, ce qui donne l’historique sans double saisie.

## 4. Droits

| Rôle | Accès |
|---|---|
| Responsable | Tout : fiches, notes, segments, campagnes, réclamations, import / export, réglages |
| Accueil | Recherche, fiches, notes, étiquettes, suivis, prise de rendez-vous, SMS individuel |
| Agent de guichet | Nom et étiquettes du visiteur appelé, ajout d’une note de passage |
| Réseau (siège) | Chiffres agrégés uniquement, jamais les fiches nominatives |

## 5. Données personnelles (loi n° 2013-450)
- Chaque établissement est responsable de ses fiches, Lerena sous-traitant (contrat de sous-traitance déjà en ligne).
- Notes : rappel permanent de ne pas y inscrire de diagnostic ou d’information médicale.
- Campagnes : uniquement avec consentement, désinscription immédiate.
- Conservation : fiche supprimée automatiquement après la durée réglée sans passage (12 mois par défaut), sauf consentement actif ; journal des consultations de fiches.
- Suppression du compte d’un visiteur : ses fiches sont supprimées dans tous les établissements.
- Déclaration ARTCI : traitement « CRM visiteurs » à ajouter au registre (déjà préparé dans `docs/CONFORMITE-ARTCI.md`).

## 6. Forfaits
| Fonction | Essentiel | Pro | Entreprise |
|---|---|---|---|
| Fichier visiteurs, fiches, notes, étiquettes (C1) | ✓ | ✓ | ✓ |
| Suivis, récurrences, relances d’absence (C2) | — | ✓ | ✓ |
| Campagnes SMS (C3) | — | ✓ | ✓ |
| Réclamations (C4) | ✓ | ✓ | ✓ |
| Tableau de bord CRM, import, fusion, export (C5) | — | ✓ | ✓ |

(Modifiable ensuite dans Console → Forfaits.)

## 7. Calendrier

| Semaine | Étape |
|---|---|
| 1 – 1,5 | C1 Fichier visiteurs |
| 2 – 3 | C2 Suivis, absences, récurrences |
| 4 – 5 | C3 Messages et campagnes |
| 6 | C4 Satisfaction et réclamations |
| 7 | C5 Pilotage, import, doublons |

Chaque étape : mise en ligne sur l’environnement de test, guide intégré mis à jour, test de bout en bout, puis passage à la suivante.

## 8. Mesures de réussite (après 2 mois d’usage)
- 80 % des visiteurs récurrents reconnus automatiquement.
- Absences aux rendez-vous en baisse de 30 %.
- 70 % des suivis traités à la date prévue.
- Avis négatifs traités en moins de 48 h.
- Responsables : moins d’une heure par mois pour prévenir leurs visiteurs (contre une journée).

## 9. Décisions à valider
1. Le périmètre et l’ordre des étapes C1 → C5.
2. La répartition par forfait (§6).
3. L’accès de l’accueil aux notes (oui par défaut).
4. La conservation des fiches (12 mois sans passage, sauf consentement).
