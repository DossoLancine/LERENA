# Plan — Direction, notifications, rôles, boutique et connecteurs

Version 2 (remplace le plan « D1 à D5 »). **Objectif** : un DG voit en 30 secondes ce que Lerena lui rapporte, où ça va mal et qui travaille bien ; ses équipes ont chacune exactement les accès dont elles ont besoin ; l’établissement vend ses produits et services pendant la visite ; et tout ce qui dépend d’un fournisseur extérieur (e-mail, SMS, WhatsApp, IA, paiement, connexion) est **déjà codé** : il suffira de coller la clé dans la console pour l’activer.

---

## 0. Réponses directes à vos questions

| Question | Réponse honnête |
|---|---|
| **Des rapports par e-mail sans fournisseur ?** | La base de données calcule et prépare les rapports elle-même, sans IA extérieure. Mais **envoyer** un e-mail passe toujours par un serveur d’envoi. Deux solutions sans nouveau fournisseur « IA » : la messagerie de votre domaine (SMTP : Gmail Workspace, Zoho, hébergeur de lerena.ci…) ou Resend (déjà intégré, gratuit jusqu’à 3 000 e-mails par mois). En attendant, chaque rapport est **aussi livré dans l’application et par notification**, ce qui ne demande aucun fournisseur. |
| **Une « IA » sans API extérieure ?** | Oui : un **assistant d’analyse intégré**, qui travaille sur vos données (statistiques, comparaisons, détection d’anomalies, regroupement des commentaires par mots-clés, prévisions d’affluence) et écrit des phrases claires. Il est fiable et gratuit, mais moins nuancé qu’une vraie IA sur les commentaires libres. L’API Claude pourra s’y ajouter plus tard sur les mêmes écrans (« analyse avancée »), sans rien changer pour l’utilisateur. |
| **Notifications même quand l’application est fermée ?** | Oui, avec les **notifications push** du standard Web (déjà utilisées pour le ticket du visiteur, à étendre à toute l’équipe). Aucun fournisseur payant : les clés sont générées par Lerena. **Android** : reçues même application fermée. **iPhone** : à partir d’iOS 16.4, à condition d’avoir installé Lerena sur l’écran d’accueil (l’application guide l’utilisateur). **Ordinateur** : reçues tant que le navigateur tourne en arrière-plan. Option plus tard : publier la même application sur le Play Store et l’App Store. |
| **Tout préparer pour brancher les API plus tard ?** | Oui : étape N1, les **connecteurs**. Chaque service extérieur a son connecteur, un mode « simulation » qui fonctionne sans clé (les messages sont enregistrés et visibles dans le journal, rien n’est envoyé), un bouton « Tester » et un état (vert, orange, rouge) dans la console de la startup. |
| **Un chatbot ?** | Non. À la place, des **réponses automatiques** simples sur WhatsApp et SMS (menu à boutons : « Mon ticket », « Mon rendez-vous », « Annuler », « Parler à l’accueil ») et une boîte de conversations tenue par l’équipe. |

---

## Principes de facilité d’utilisation (pour chaque étape)

1. **Rien à régler pour commencer** : valeurs par défaut adaptées au secteur (santé, banque, administration, commerce) ; les réglages sont facultatifs.
2. **Une phrase avant les chiffres** : « L’attente a baissé de 12 min ce mois-ci à Cocody », puis le détail. Aucun jargon.
3. **Le DG n’a pas à se connecter** : rapports et alertes arrivent dans l’application, en notification, par e-mail, puis par WhatsApp.
4. **Téléphone d’abord** : tout se lit et s’utilise sur un écran de 6 pouces.
5. **« Voir un exemple »** sur chaque rapport, alerte, produit ou rôle, même sans données.
6. **Une action à côté de chaque problème** : « Relancer ces 23 clients », « Ouvrir un guichet », « Encaisser ».
7. **Pas d’impasse** : si un connecteur n’est pas branché, l’écran le dit simplement (« WhatsApp sera disponible dès son activation ») et propose l’autre canal.

---

## N1 · Connecteurs « prêts à brancher » — *1 semaine*

**Console de la startup → Intégrations** : une carte par service, avec champ de clé, « Tester », état, dernier envoi réussi, volume du mois, et passage simulation ↔ production. Les clés sont chiffrées dans la base (comme le secret de double authentification) : **aucun redéploiement** pour activer un service.

| Connecteur | Prestataires prévus | Sans clé (simulation) | Ce qu’il faudra fournir |
|---|---|---|---|
| E-mail | SMTP (toute messagerie), Resend | Enregistré dans le journal, visible par la startup | Identifiants SMTP ou clé Resend, adresse d’expéditeur |
| SMS | Passerelle HTTP générique, Orange, MTN, Infobip, Twilio | Simulé, quotas décomptés pour tester | Clé, nom d’expéditeur (« LERENA ») |
| WhatsApp Business | Meta (API Cloud), 360dialog, Twilio | Simulé ; le canal SMS prend le relais | Numéro WhatsApp Business validé, clé, modèles approuvés par Meta |
| Notifications push | Interne (standard Web, clés VAPID) | **Fonctionne déjà, sans fournisseur** | Rien (clés générées par Lerena) |
| IA (analyse avancée) | API Claude d’Anthropic | Assistant d’analyse intégré seul | Clé API |
| Paiement en ligne | Wave, Orange Money, MTN MoMo, ou agrégateur (CinetPay, Paydunya) | Paiement validé à la main par l’équipe | Compte marchand, clés |
| Connexion | Google, Microsoft (entreprises), codes par SMS ou WhatsApp | Mot de passe et double authentification (existants) | Identifiants OAuth du compte Google ou Microsoft |

**Règles communes** : nouvel essai automatique en cas d’échec, bascule vers le canal suivant (WhatsApp → SMS → notification → e-mail), limite d’envoi par établissement, coût enregistré par message, journal unique des envois (déjà en place) avec filtre par connecteur.

**Fini quand** : la console liste les 7 connecteurs, tous en simulation ; coller une clé SMTP de test fait passer l’e-mail en « réel » après « Tester », sans redéploiement.

## N2 · Notifications partout, même application fermée — *1 semaine*

**Centre de notifications** (cloche dans toutes les interfaces professionnelles)
- Compteur de non-lues, liste avec lien direct, « tout marquer comme lu », historique 90 jours.
- Mise à jour en temps réel quand l’application est ouverte.

**Notifications push application fermée** (équipe, DG, et visiteurs)
- Activation en un appui à la première connexion, avec explication ; pour l’iPhone, guide en 3 images « Ajouter à l’écran d’accueil ».
- Visiteurs : déjà en place pour le ticket ; ajout du rappel de rendez-vous, de « votre commande est prête » et du lien de suivi.

**Catalogue d’événements**, chacun réglable par personne et par canal (application, notification, e-mail, WhatsApp, SMS) :
nouveau rendez-vous · avis négatif · avis non traité sous 48 h · suivi du jour · attente trop longue · file trop longue · site ouvert sans guichet actif · nouvelle commande boutique · commande à encaisser · campagne terminée · SMS bientôt épuisés · facture à payer · rapport prêt.

**Réglages simples** : préréglages par rôle (un agent ne reçoit pas les factures), heures de silence (par défaut 21 h – 7 h, sauf urgences), regroupement (« 5 nouveaux rendez-vous » au lieu de 5 notifications).

**Fini quand** : avec l’application fermée sur un téléphone Android, un responsable reçoit « Avis négatif à Cocody » moins d’une minute après l’avis, et l’appui ouvre l’avis.

## N3 · Rôles et accès — *1,5 semaine*

**Organisation en niveaux** : Réseau ou groupe → Régions (nouveau, regroupement de sites) → Sites ou agences → Services et guichets.

**Rôles proposés** (chacun limité à un **périmètre** : tout l’établissement, une région, ou des sites choisis)

| Rôle | Peut |
|---|---|
| Propriétaire | Tout, y compris abonnement, factures, transfert de propriété, suppression |
| Directeur général | Tout voir et piloter sur tous les sites ; gérer les responsables |
| Directeur régional | Piloter les sites de sa région |
| Responsable de site | Gérer son site : équipe, services, guichets, CRM, boutique, campagnes |
| Accueil | Tickets, rendez-vous, fichier visiteurs, suivis, commandes |
| Agent de guichet | Appeler, servir, voir les étiquettes et la commande du visiteur appelé |
| Caissier ou vendeur | Commandes boutique : encaisser, remettre, annuler |
| Comptable | Factures, ventes, exports financiers ; aucune donnée de visiteur |
| Auditeur | Tout en lecture seule, journal d’audit compris |

**Matrice des droits** : une page « Rôles » montre, module par module (file, rendez-vous, visiteurs, campagnes, avis, boutique, statistiques, équipe, abonnement), ce que chaque rôle peut voir, modifier ou supprimer.
- **Rôles sur mesure** : « dupliquer » un rôle et cocher ou décocher des droits.
- **Accès temporaire** : date de fin pour un intérimaire ou un stagiaire, coupure automatique.
- **Garde-fous** : personne ne peut donner plus de droits qu’il n’en a ; double authentification obligatoire pour Propriétaire, DG et Responsable ; au moins un Propriétaire toujours présent.
- **Revue des accès** : rappel mensuel au DG (« 3 comptes inactifs depuis 60 jours : les désactiver ? »).
- **Journal** : chaque changement de rôle ou de périmètre est tracé.
- **Reprise de l’existant** : MANAGER → Responsable (tous sites), RECEPTION → Accueil, AGENT → Agent ; aucun compte actuel ne perd d’accès.

**Fini quand** : un directeur régional connecté ne voit que les 3 sites de sa région, partout (file, statistiques, CRM, boutique, rapports), et un accès temporaire se coupe seul à sa date.

## N4 · Rapports et alertes — *1 semaine*

**Rapports préparés par l’application** (aucune IA extérieure nécessaire)
- **Quotidien** (fin de journée, facultatif), **hebdomadaire** (lundi 8 h), **mensuel** (le 1er), **avant / après Lerena** (à la demande).
- Contenu adapté au rôle et au périmètre : 4 chiffres clés avec évolution, « ce qui va bien / ce qui va mal », agences à surveiller, argent perdu et clients à risque (N6), synthèse des avis (N5), ventes de la boutique (N7).
- **Livraison** : page « Rapports » dans l’application (archive de tous les rapports) + notification « Votre rapport est prêt » + e-mail dès que le connecteur e-mail est branché + WhatsApp dès N8. PDF généré par l’application, à imprimer ou transférer.
- Destinataires : par rôle (ex. tous les directeurs) ou adresses ajoutées ; « M’envoyer un exemple maintenant ».

**Alertes en direct** : attente supérieure au seuil (45 min par défaut), file de plus de 30 personnes, 3 avis négatifs en une heure, site ouvert sans guichet actif depuis 20 min, avis non traité sous 48 h (au responsable, puis au DG), SMS bientôt épuisés. Interrupteur et seuil par alerte ; pas de répétition avant 1 heure.

**Fini quand** : le lundi à 8 h, le DG trouve le rapport dans l’application et reçoit la notification ; avec un connecteur e-mail de test, il le reçoit aussi par e-mail.

## N5 · Assistant d’analyse intégré — *1 semaine*

Tout est calculé dans Lerena, sans service extérieur.
- **Phrases automatiques** à partir des chiffres : tendances, meilleures et pires agences, comparaison à la même semaine du mois précédent.
- **Anomalies** : écart inhabituel par rapport à l’habitude du même jour et de la même heure (« attente du mardi 2 fois plus longue que d’habitude »).
- **Thèmes des avis** : regroupement des commentaires par dictionnaire de mots-clés en français et en nouchi courant (attente, accueil, propreté, prix, erreur, orientation, confort…), part de chaque thème, citation anonymisée.
- **Prévision d’affluence** : moyenne des semaines passées par jour et par heure, et « demain 9 h, prévoyez 2 guichets de plus ».
- **Recommandations par règles** : « Le lundi de 8 h à 10 h, l’attente dépasse 40 min à la caisse : ouvrez un guichet de plus. »
- **Réponse proposée** à un avis négatif, à partir de modèles selon le motif, à relire avant l’envoi.
- **Analyse avancée** (option, connecteur IA) : mêmes écrans, regroupement plus fin des commentaires libres et rédaction plus naturelle, badge « analyse avancée ». Seuls les textes anonymisés partent (aucun nom ni numéro), mention au registre ARTCI. Coût estimé : 15 à 30 FCFA par établissement et par semaine avec l’API Claude.

**Fini quand** : sur 50 commentaires réels d’un établissement test, l’assistant classe correctement au moins 4 commentaires sur 5 dans leur thème, et la prévision du lendemain s’écarte de moins de 25 % de l’affluence réelle.

## N6 · Vue direction, classement et valeur en FCFA — *2 semaines*

**Vue multi-agences** (selon le périmètre du rôle) : une ligne par agence (visiteurs du jour, attente actuelle et moyenne, satisfaction, absences, avis ouverts, ventes) avec pastille verte, orange ou rouge, tri « les plus en difficulté d’abord », carte, et accès au détail d’un clic. Le siège d’un réseau ne voit que des chiffres, jamais de fiche nominative.

**Objectifs par agence** : attente cible et satisfaction cible (pré-remplies selon le secteur), barre de progression, « objectif atteint » dans le rapport.

**Classement des agents**, équitable : comparaison au sein du même service, minimum 20 tickets dans la période, durée rapportée à la moyenne du service ; « équipe du mois » et progression personnelle ; pas d’affichage public des derniers.

**Valeur en FCFA** (réglage facultatif, valeurs proposées par secteur) : argent perdu par les absences, **clients à risque** (habitués dont la fréquence chute) avec leur valeur annuelle et « Relancer », valeur des clients perdus, temps gagné par les visiteurs (comparé à l’attente relevée avant Lerena), page avant / après prête pour le conseil d’administration.

**Fini quand** : un DG de 5 agences voit sur son téléphone laquelle est en difficulté et pourquoi, et le rapport affiche « Absences : 340 000 FCFA perdus ce mois, 23 clients à risque (1,2 M FCFA par an) ».

## N7 · Boutique de l’établissement — *2 semaines*

Remplace et élargit l’actuel « Promotions ».

**Catalogue** (menu « Boutique » du responsable)
- Trois types : **produit physique** (carnet de santé, médicament en vente libre, carte bancaire, timbre…), **produit numérique** (attestation, code d’accès, carte de recharge, document à télécharger), **service** (livraison à domicile, prise en charge prioritaire payante, photocopie, consultation complémentaire).
- Pour chacun : nom, photo, description courte, prix (et prix barré pour une promotion), stock facultatif (alerte stock bas), sites où il est vendu, services concernés, actif ou non.
- **Moments d’affichage** cochés par produit : pendant la prise de rendez-vous, à la prise du ticket (application et borne), pendant l’attente (bas de la page du ticket, comme aujourd’hui), après le service.

**Côté visiteur** : « Ajouter » en un appui, petit panier, puis « Réserver » ; il paie au guichet ou à la caisse (paiement en ligne quand le connecteur Paiement sera branché). Il suit l’état de sa commande sur son ticket ou son rendez-vous.

**Côté équipe : c’est l’établissement qui valide**
- États d’une commande : **Demandée → Confirmée → Payée → Remise** (ou livrée, ou envoyée pour un produit numérique), avec à tout moment **Annulée** ou **Remboursée**, motif à l’appui.
- Mode de paiement noté à l’encaissement : espèces, Mobile Money (Wave, Orange, MTN, Moov), carte, virement, offert.
- **Au guichet** : la commande du visiteur appelé s’affiche (« 2 articles · 7 500 FCFA · à encaisser ») avec les boutons « Payée », « Remise », « Annuler ».
- **Écran « Commandes »** pour l’accueil et la caisse : à confirmer, à encaisser, à remettre, avec notification à chaque nouvelle commande.
- Produit numérique : à la validation « Payée », le lien ou le code part automatiquement (notification, puis e-mail, SMS ou WhatsApp selon les connecteurs).
- Reçu numéroté pour chaque commande payée (à imprimer ou envoyer).

**Pilotage** : chiffre d’affaires par jour, produit, site et vendeur ; parcours « vu → ajouté → réservé → payé » ; produits les plus vendus ; dans le CRM, les achats apparaissent sur la fiche du visiteur et un segment « Clients de la boutique » est ajouté. Chaque changement de prix est inscrit au journal.

**Fini quand** : un visiteur ajoute une attestation et un carnet de santé pendant son attente, l’agent voit « à encaisser » au moment de l’appel, marque « Payée » puis « Remise », l’attestation part au visiteur, et la vente apparaît dans les statistiques et sur sa fiche.

## N8 · WhatsApp, SMS et conversations — *1,5 semaine*

- **Envoi** : rappels, ticket bientôt appelé, suivis, campagnes, rapports et alertes du DG ; canal choisi automatiquement (WhatsApp, sinon SMS), modèles de messages préparés pour la validation par Meta.
- **Boîte « Conversations »** par établissement : réponses des visiteurs (WhatsApp et SMS) sur leur fiche et dans une boîte commune, pastille, attribution à un membre de l’équipe, réponses rapides, état « traité ».
- **Réponses automatiques** (pas de chatbot) : menu à boutons « Mon ticket », « Mon rendez-vous », « Annuler mon rendez-vous », « Parler à l’accueil » ; message d’absence hors des horaires ; passage immédiat à un humain sur demande.
- **Prise de ticket par WhatsApp** (option) : « TICKET » au numéro de l’établissement → choix du service → ticket reçu avec le lien de suivi.
- **Décompte réel des SMS** : un SMS long ou accentué compte pour le nombre de parties facturées par l’opérateur, affiché avant chaque envoi.
- « STOP » reçu par SMS ou WhatsApp : désinscription automatique (déjà prête).

**Fini quand** : en simulation, tout le parcours est visible dans le journal et la boîte de conversations ; une fois les clés posées, un visiteur reçoit son rappel sur WhatsApp, répond « je serai en retard », et la réponse arrive à l’accueil.

## N9 · Connexion et sécurité des comptes — *1 semaine*

- **Visiteurs** : connexion par **code reçu par SMS ou WhatsApp** (sans mot de passe), par lien envoyé par e-mail, ou par compte Google ; le mot de passe actuel reste possible.
- **Équipes** : mot de passe et double authentification (existants) ; **connexion Microsoft ou Google** pour les entreprises qui le demandent (banques, groupes) ; liste des appareils connectés et déconnexion à distance (existante, étendue).
- Récupération de compte par SMS ou WhatsApp en plus de l’e-mail.
- Chaque méthode s’active depuis la console de la startup dès que son connecteur est branché ; sans connecteur, elle n’apparaît pas.

**Fini quand** : en simulation, le code de connexion apparaît dans le journal de la startup et permet de se connecter ; avec la clé SMS, il arrive sur le téléphone.

---

## Forfaits proposés

| Fonction | Essentiel | Pro | Entreprise |
|---|---|---|---|
| N2 Notifications (application, push) | ✓ | ✓ | ✓ |
| N3 Rôles et accès | Rôles standards | + accès temporaires | + rôles sur mesure, régions |
| N4 Rapports et alertes | Rapport hebdomadaire | ✓ | ✓ |
| N5 Assistant d’analyse intégré | — | ✓ | ✓ + analyse avancée (IA) |
| N6 Vue direction, classement, FCFA | — | ✓ (plusieurs sites) | ✓ + espace réseau |
| N7 Boutique | 10 produits | Illimité | Illimité + paiement en ligne |
| N8 WhatsApp et conversations | — | Option payante par message | ✓ (quota inclus) |
| N9 Connexion Microsoft ou Google pour l’équipe | — | — | ✓ |

## Calendrier (environ 12 semaines)

| Semaines | Étape | De votre côté, en parallèle |
|---|---|---|
| 1 | N1 Connecteurs | Choisir la messagerie d’envoi (SMTP ou Resend) |
| 2 | N2 Notifications | |
| 3 – 4 | N3 Rôles et accès | Ouvrir les comptes SMS et WhatsApp Business (validation Meta : quelques jours) |
| 5 | N4 Rapports et alertes | |
| 6 | N5 Assistant d’analyse | (Facultatif) créer la clé API Anthropic |
| 7 – 8 | N6 Vue direction et FCFA | |
| 9 – 10 | N7 Boutique | (Facultatif) compte marchand Mobile Money |
| 11 – 12 | N8 WhatsApp et N9 Connexion | Coller les clés dans la console, valider les modèles WhatsApp |

Chaque étape : en ligne sur l’environnement de test, guide intégré mis à jour, test de bout en bout, puis la suivante. Tout fonctionne en simulation avant que les clés ne soient posées.

## Données personnelles
- Les rapports et l’assistant n’utilisent que les données de l’établissement, selon le périmètre du rôle.
- Boutique : les commandes sont rattachées à la fiche du visiteur et suivent la même conservation (12 mois sans passage).
- IA, SMS, WhatsApp, e-mail et paiement : chaque prestataire activé est ajouté au registre ARTCI et à la politique de confidentialité ; vers l’IA, uniquement des textes anonymisés.

## Mesures de réussite (après 1 mois)
- 80 % des DG ouvrent le rapport hebdomadaire.
- 90 % des responsables ont activé les notifications push.
- Moins d’1 alerte sur 5 jugée inutile.
- Au moins 10 % des visiteurs exposés à la boutique ajoutent un produit, et 70 % des commandes sont validées (payées ou annulées) le jour même.

## Décisions à valider
1. Le périmètre et l’ordre N1 → N9.
2. La messagerie d’envoi des e-mails : SMTP de votre domaine ou Resend.
3. Les rôles proposés et la reprise des comptes actuels.
4. La boutique remplace « Promotions » (les promotions existantes deviennent des produits avec prix barré).
5. La répartition par forfait.
6. Les seuils d’alerte par défaut (attente 45 min, file de 30 personnes, 3 avis négatifs par heure).
