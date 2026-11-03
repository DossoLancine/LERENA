# Conformité : protection des données personnelles (Côte d’Ivoire)

Cadre : **loi n° 2013-450 du 19 juin 2013** relative à la protection des données à caractère personnel, contrôlée par l’**ARTCI** (Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire).

> Ce dossier prépare les démarches ; il ne remplace pas l’avis d’un juriste. Faire relire les documents légaux (`/legal/...`) avant le lancement commercial.

## 1. Ce qui est déjà en place dans l’application

| Exigence | Où |
|---|---|
| Information des personnes | `/legal/confidentialite`, lien sur l’accueil, la connexion, l’inscription, le profil, la prise de ticket sans compte |
| Consentement aux conditions | Case obligatoire à l’inscription ; date et version enregistrées (`termsAcceptedAt`, `termsVersion`) |
| Consentement notifications / position | Demandés par le navigateur au moment de l’usage, refus sans conséquence |
| Cookies | Uniquement indispensables (session, choix du site) : pas de bandeau nécessaire |
| Droit d’accès et de portabilité | Profil → « Demander une copie de mes données » (demande tracée, e-mail à l’équipe) ; réponse sous 30 jours avec l’export de Console → Utilisateurs |
| Droit à l’effacement | Profil → Supprimer mon compte ; Console → Utilisateurs → supprimer (tickets anonymisés) |
| Durées de conservation | Purge et anonymisation automatiques chaque nuit (voir `docs/EXPLOITATION.md`) |
| Sécurité | HTTPS, mots de passe hachés, double authentification des administrateurs, secrets à usage unique, journal des actions, limites anti-abus, sauvegardes |
| Sous-traitance | `/legal/sous-traitance` (annexe aux CGV) |
| Écrans publics | Seuls le numéro de ticket et le guichet s’affichent ; jamais le nom ni le motif de priorité |

## 2. Démarches à faire (par Lerena)

1. **Déclaration / demande d’autorisation** des traitements auprès de l’ARTCI (formulaires sur le site de l’ARTCI). Traitements à déclarer :
   - gestion des comptes visiteurs et des tickets ;
   - prise de rendez-vous et rappels par SMS ;
   - fichier visiteurs des établissements (CRM : fiches, historique, étiquettes, notes) ;
   - gestion des comptes des établissements clients et facturation ;
   - sécurité (journaux de connexion, adresses IP).
2. **Transfert hors de Côte d’Ivoire** : l’application est hébergée par Vercel (États-Unis) et la base par Supabase (Union européenne). Le transfert est soumis à autorisation de l’ARTCI ; joindre les engagements contractuels des hébergeurs (DPA de Vercel et de Supabase). Option à étudier : hébergement de la base en Afrique ou en Côte d’Ivoire pour les clients publics.
3. Renseigner le **numéro de déclaration** et le **contact données personnelles** dans Console → Facturation → Données personnelles : ils apparaissent automatiquement dans la politique de confidentialité et les mentions légales.
4. Désigner une personne chargée des demandes (accès, suppression) : réponse sous **30 jours**.

## 3. Registre des traitements (à tenir à jour)

| Traitement | Finalité | Personnes | Données | Base | Durée | Destinataires |
|---|---|---|---|---|---|---|
| Comptes visiteurs | Accès au service | Visiteurs | Nom, téléphone, e-mail, code chiffré | Contrat (CGU) | Jusqu’à suppression | Lerena |
| Tickets et rendez-vous | Gestion des files | Visiteurs | Service, horaires, nom / téléphone (sans compte) | Contrat ; pour le compte de l’établissement | Anonymisés après 12 mois | Établissement, Lerena |
| Fichier visiteurs (CRM) | Accueil et suivi des visiteurs par l’établissement | Visiteurs | Nom, téléphone, historique des passages, notes de l’équipe, étiquettes, avis, accord pour les messages | Intérêt légitime de l’établissement ; consentement pour les messages | Supprimé 12 mois après le dernier passage (sauf accord actif) ; consultations, imports, fusions et exports journalisés ; export réservé au responsable | Établissement, Lerena |
| Notifications et SMS | Prévenir du tour | Visiteurs | Abonnement push, téléphone | Consentement | 6 mois (contenu) | Fournisseurs SMS / e-mail |
| Équipes des établissements | Accès au back-office | Agents, responsables | Nom, e-mail, téléphone, connexions | Contrat (CGV) | Durée de l’abonnement | Établissement, Lerena |
| Facturation | Facturer les établissements | Contacts des clients | Raison sociale, contacts, factures, paiements | Obligation légale | 10 ans (comptabilité) | Lerena |
| Sécurité | Prévenir les abus | Tous | Adresse IP, appareil, journaux | Intérêt légitime | 30 à 90 jours | Lerena |

## 4. Établissements clients (santé, administrations)

- Ils sont **responsables** des données de leurs visiteurs ; Lerena est **sous-traitant** (`/legal/sous-traitance`).
- Leur rappeler d’afficher l’affiche Lerena (information des visiteurs) et d’accomplir leurs propres formalités ARTCI si nécessaire.
- **Santé** : nommer les services sans information médicale (« Consultation », pas « Dépistage VIH ») et ne pas inscrire de diagnostic dans les notes des agents.

## 5. Violation de données

1. Contenir : révoquer les sessions concernées, changer les secrets (`NEXTAUTH_SECRET`, `TWO_FACTOR_KEY`, mot de passe de la base), corriger la faille.
2. Évaluer : quelles données, combien de personnes, quels établissements.
3. Notifier l’ARTCI et les établissements concernés **dans les meilleurs délais (objectif 72 h)** ; informer les personnes si le risque est élevé.
4. Consigner l’incident (date, nature, mesures) dans un registre des violations.
