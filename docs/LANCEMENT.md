# Lancement de Lerena : pilote, go / no-go, kit commercial

État au 2 novembre 2026. ✅ fait et vérifié · 🟡 fait, à compléter sur le terrain · ⏳ action de votre côté.

## 1. Revue go / no-go

### Technique (phases 1 à 14)

| Critère | État |
|---|---|
| Sécurité des comptes : limites de connexion, 2FA des administrateurs, sessions révocables | ✅ (2FA obligatoire dès `ATTENDS_ENV=production`) |
| Tests automatiques (unitaires, test de fumée) et intégration continue | ✅ |
| Récupération de compte autonome (e-mail, SMS) | ✅ (envoi réel dès qu’un fournisseur est branché) |
| SMS et e-mails | 🟡 simulés tant que `RESEND_API_KEY` et `SMS_PROVIDER` ne sont pas définis |
| Plusieurs sites par établissement | ✅ |
| Rendez-vous complets (sans compte, code d’arrivée, rappels, absences) | ✅ |
| Console Lerena : clients, forfaits, factures, paiements, prospects | ✅ |
| Paiement Mobile Money automatique | ⏳ compte marchand (CinetPay, PayDunya…) ; en attendant, encaissement manuel |
| Surveillance : journal d’erreurs, alertes, `/api/health`, `/status` | ✅ ; ⏳ moniteur UptimeRobot |
| Sauvegarde et **restauration testée** | ⏳ exercice à faire une fois (`docs/EXPLOITATION.md`) |
| Test de charge (lecture) | ✅ 0 % d’erreur, pages p95 = 333 ms |
| Documents légaux en ligne, consentement, export / suppression des données | ✅ ; ⏳ relecture juridique |
| Déclaration ARTCI | ⏳ (`docs/CONFORMITE-ARTCI.md`) |
| Logo de l’établissement sur TV, borne, ticket ; assistant de démarrage | ✅ |
| Interface en anglais, voix en ligne | ⏳ non prioritaire pour le lancement ivoirien |

### Configuration de production (à faire une fois)

1. Projet Vercel et base Supabase **de production**, distincts du test ; `ATTENDS_ENV=production`, `PRODUCTION_DB_REF`.
2. Variables : `NEXTAUTH_SECRET` (nouveau), `TWO_FACTOR_KEY`, `CRON_SECRET`, `ALERT_EMAIL`, `RESEND_API_KEY` + `EMAIL_FROM`, `SMS_PROVIDER` et ses identifiants.
3. Nom de domaine (ex. `lerena.ci`), e-mails à ce nom, `NEXT_PUBLIC_APP_URL`.
4. Console → Facturation : société, RCCM, NCC, TVA, moyens de paiement, contact données personnelles, n° ARTCI.
5. Console → Forfaits et Catalogue : prix définitifs.
6. Changer le mot de passe de la base de test, rendre le dépôt GitHub privé, pousser l’historique propre.

**Décision go** : toutes les lignes ⏳ « bloquantes » faites : production configurée, SMS réels, restauration testée, documents relus, déclaration ARTCI déposée.

## 2. Pilote de 4 semaines

Objectif : prouver un gain mesurable dans 1 ou 2 établissements (une clinique, une agence) et en tirer une étude de cas.

| Quand | Quoi | Qui |
|---|---|---|
| J-7 | Visite : compter les visiteurs par jour, chronométrer l’attente (20 visiteurs au hasard, de l’arrivée à l’appel), photos de la salle | Lerena |
| J-7 | Console → client → **Pilote** : saisir date de début, attente « avant », visiteurs par jour « avant » | Lerena |
| J-1 | Installation : TV, borne, affiches ; assistant de démarrage à 100 % ; prolonger l’essai pour couvrir le pilote | Lerena + responsable |
| J0 | Formation (voir §3), présence sur place toute la journée | Lerena |
| S1 | Passage quotidien ou appel ; corrections rapides ; notes dans « Observations de terrain » | Lerena |
| S2–S4 | Point hebdomadaire de 15 min avec le responsable ; suivi du rapport de pilote | Lerena + responsable |
| Fin S4 | Rapport imprimé (« Imprimer l’étude de cas »), témoignage du responsable, décision d’abonnement | Lerena |

**Indicateurs** (rapport automatique) : attente moyenne avant / après et tendance par semaine, visiteurs par jour, absents à l’appel, temps au guichet, satisfaction (étoiles des visiteurs), incidents techniques.

**Réussi si** : attente vécue en salle réduite d’au moins 30 %, moins de 10 % d’absents, satisfaction ≥ 4 / 5, aucun incident bloquant, le responsable accepte de témoigner.

## 3. Formation sur place

| Public | Durée | Contenu |
|---|---|---|
| Responsable | 1 h | Tableau de bord, services et guichets, équipe, appareils (QR d’installation), priorités, rendez-vous, abonnement, guide intégré |
| Agents de guichet | 30 min | Écran Guichet : choisir son guichet, appeler (Espace), commencer, terminer, absent, transférer, rappeler ; raccourcis clavier |
| Accueil | 30 min | Créer un ticket pour une personne sans téléphone, priorités, rendez-vous du jour (code d’arrivée), impression |

Laisser sur place : affiche QR imprimée, fiche « Guichet en 5 gestes », numéro du support.

## 4. Support

- Canal : un numéro WhatsApp professionnel + l’e-mail de la société, affichés dans la console et sur les factures.
- Heures : 8 h – 18 h du lundi au samedi pendant les 2 premiers mois ; réponse sous 1 h ouvrée.
- Incident bloquant (plus de tickets, écrans figés) : rappel immédiat ; vérifier `/status` et Console → Santé ; retour à la version précédente sur Vercel si un déploiement est en cause.
- Chaque demande : notée dans le journal du client (Console → client → notes internes).

## 5. Kit commercial

### Message en une phrase

> Lerena supprime les salles d’attente bondées : vos visiteurs prennent un ticket par QR code, borne ou accueil, et sont prévenus sur leur téléphone quand leur tour approche.

### Démonstration (15 minutes)

1. Scanner l’affiche avec le téléphone du prospect → ticket en 10 secondes, sans compte.
2. Sur l’écran Guichet, appeler ce ticket → la TV l’annonce, le téléphone vibre.
3. Montrer la borne (tablette) et le ticket imprimé avec **son logo**.
4. Ouvrir le tableau de bord : attente en direct, statistiques, assistant de démarrage.
5. Prise de rendez-vous et rappel SMS.
6. Terminer sur la page **/tarifs** et l’essai gratuit.

### Objections fréquentes

| Objection | Réponse |
|---|---|
| « Nos visiteurs n’ont pas de smartphone » | Borne et accueil impriment un ticket ; l’écran TV et l’annonce vocale suffisent |
| « Pas de bonne connexion » | Quelques kilo-octets par écran ; reprise automatique après coupure ; box 4G de secours |
| « Trop cher » | Prix par site, essai gratuit ; gain mesuré pendant le pilote ; matériel en location |
| « Nos données ? » | Loi 2013-450 respectée, contrat de sous-traitance, export et suppression à la demande |

### Documents

- Grille tarifaire : page publique **/tarifs** (toujours à jour avec la console).
- Étude de cas : rapport de pilote imprimé depuis la console.
- Plaquette : reprendre le message, les 6 bénéfices de /tarifs, la photo de la TV en salle et le chiffre clé du pilote.

## 6. Lancement

1. Go validé (§1).
2. Ouvrir la page /tarifs au public ; les demandes arrivent dans **Console → Prospects** avec un e-mail à chaque demande.
3. Premières semaines : appel de chaque prospect sous 24 h, démonstration sous une semaine, mise en service en une visite.
4. Objectif de fin de phase : **3 établissements payants actifs** (visible dans Console → Vue d’ensemble).
