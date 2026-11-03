# Plan — Fonctions « Direction » (pour convaincre et garder les DG)

**Objectif** : qu’un directeur général voie en 30 secondes, sans ouvrir l’application, ce que Lerena lui rapporte, où ça va mal et qui travaille bien, puis agisse en un geste.

**Principe de facilité d’utilisation** (appliqué à chaque étape) :
1. **Rien à régler pour commencer** : chaque fonction marche dès l’activation, avec des valeurs par défaut adaptées au secteur (santé, banque, administration…). Les réglages sont facultatifs.
2. **Une phrase avant les chiffres** : « L’attente a baissé de 12 min ce mois-ci à Cocody », puis le détail. Pas de jargon (pas de « KPI », « NPS », « churn »).
3. **Le DG n’a pas à se connecter** : rapport et alertes arrivent là où il est déjà (e-mail, WhatsApp, notification sur téléphone). Un lien ouvre directement la bonne page.
4. **Pensé pour le téléphone d’abord** : tout se lit sur un écran de 6 pouces.
5. **Bouton « Voir un exemple »** partout : le DG voit le rapport ou l’alerte avant même d’avoir des données.
6. **Une action à côté de chaque problème** : « Relancer ces 23 clients », « Ouvrir un guichet », « Appeler le visiteur ».

---

## D1 · Rapport du lundi et alertes en direct — *1 semaine*

**Rapport hebdomadaire** (chaque lundi 8 h, e-mail ; WhatsApp dès D5)
- Une page : 4 chiffres clés (visiteurs, attente moyenne, satisfaction, absences) avec l’évolution par rapport à la semaine d’avant et une flèche verte ou rouge.
- « Ce qui va bien / ce qui va mal » en 3 lignes, les 3 agences ou services à surveiller, et à partir de D3 et D4 : argent perdu, clients à risque, synthèse des avis.
- Destinataires : le responsable par défaut ; ajout d’autres e-mails (DG, DAF) dans Paramètres → Rapports, avec « M’envoyer un exemple maintenant ».
- Rapport mensuel le 1er du mois (même format, sur le mois).

**Alertes en direct** (notification sur le téléphone + e-mail ; WhatsApp dès D5)
- Attente supérieure au seuil (par défaut 45 min) ou file de plus de 30 personnes sur un site.
- 3 avis négatifs en une heure sur un site.
- Site ouvert sans aucun guichet actif depuis 20 minutes pendant les horaires.
- Avis à traiter depuis plus de 48 h (rappel au responsable, puis au DG s’il est inscrit).
- Réglages simples : interrupteur par alerte, seuil modifiable, « pas d’alerte la nuit ». Une même alerte ne se répète pas avant 1 heure.

**Fini quand** : un DG inscrit reçoit son rapport le lundi à 8 h et une alerte arrive sur son téléphone moins de 5 minutes après le dépassement du seuil.

## D2 · Vue direction multi-agences et classement — *1,5 semaine*

**Vue d’ensemble des sites** (établissement à plusieurs sites, et espace réseau du siège)
- Un tableau, une ligne par agence : visiteurs du jour, attente actuelle et moyenne, satisfaction, absences, avis ouverts, avec une pastille verte, orange ou rouge.
- Carte des agences avec la même couleur, tri par « les plus en difficulté d’abord ».
- Un clic sur une agence : son tableau de bord détaillé.
- Le siège d’un réseau ne voit que des chiffres, jamais de fiche nominative (déjà prévu dans le plan CRM).

**Objectifs par agence**
- Attente cible et satisfaction cible (pré-remplies selon le secteur), barre de progression, et « objectif atteint » dans le rapport du lundi.

**Classement des agents** (responsable et siège seulement)
- Par agent : tickets traités, durée moyenne au guichet, satisfaction, avis négatifs.
- **Équitable** : comparaison au sein du même service uniquement, minimum 20 tickets dans la période pour apparaître, durée rapportée à la moyenne du service.
- Vue « équipe du mois » et progression personnelle. Pas d’affichage public des derniers : le but est de motiver, pas d’humilier.

**Fini quand** : un DG de 5 agences voit sur son téléphone laquelle est en difficulté et pourquoi, en un écran.

## D3 · La valeur en FCFA — *1 semaine*

**Réglage en une étape** (facultatif, avec des valeurs proposées par secteur)
- Valeur moyenne d’une visite par service (ex. consultation 5 000 FCFA) et coût d’un rendez-vous manqué (par défaut, la valeur de la visite).

**Ce qui est calculé**
- **Argent perdu par les absences** au mois : rendez-vous manqués × coût.
- **Clients à risque** : habitués dont la fréquence chute (pas revenus depuis plus du double de leur rythme habituel), avec leur valeur annuelle estimée et le bouton « Relancer » (SMS de campagne ou suivi).
- **Valeur des clients perdus** au trimestre.
- **Temps gagné par vos visiteurs** : attente avant Lerena (relevé à la mise en service du pilote, déjà enregistré) comparée à l’attente actuelle × nombre de visiteurs ; présenté en heures et en équivalent jours de travail.
- **Avant / après Lerena** : une page prête pour le conseil d’administration (attente, satisfaction, absences, temps gagné), imprimable en PDF.

**Fini quand** : le rapport du lundi affiche une ligne « Absences : 340 000 FCFA perdus ce mois, 23 clients à risque (1,2 M FCFA / an) » avec le bouton pour agir.

## D4 · Synthèse des avis par l’IA — *1 semaine*

**L’IA passe par une API externe** : l’API Claude d’Anthropic, appelée depuis le serveur de Lerena avec le SDK officiel (`@anthropic-ai/sdk`) et une clé `ANTHROPIC_API_KEY` dans Vercel. Aucun modèle n’est hébergé chez nous.

**Ce qui est livré**
- **Synthèse hebdomadaire** par établissement (et par site) : 3 à 5 thèmes avec leur part (« 60 % des plaintes : attente le lundi matin à la caisse »), une citation représentative anonymisée par thème, 3 recommandations concrètes, et ce qui s’améliore par rapport à la semaine d’avant.
- Affichée en tête de l’onglet Avis et dans le rapport du lundi.
- **Réponse suggérée** à un avis négatif : un bouton dans la fenêtre de traitement propose un SMS d’excuses adapté, que le responsable relit et modifie avant l’envoi.
- « Mettre à jour la synthèse maintenant » (3 fois par jour au plus).

**Protection des données**
- Seuls partent vers l’API : les commentaires, motifs, notes, services, guichets et dates. **Jamais** de nom, de numéro ou de compte ; noms et numéros éventuellement écrits dans un commentaire sont masqués avant l’envoi.
- Ce transfert est ajouté au registre ARTCI et à la politique de confidentialité (sous-traitant : Anthropic, États-Unis).
- Sans clé configurée, ou si l’établissement refuse l’IA (interrupteur dans Paramètres), la fonction est masquée ; tout le reste marche.

**Modèle et coût**
- Modèle : **Claude Opus 5.5** (`claude-opus-5-5`), 4 $ par million de jetons en entrée, 20 $ en sortie.
- Une synthèse hebdomadaire d’environ 200 commentaires ≈ 9 000 jetons lus et 800 écrits ≈ **0,05 $ (≈ 30 FCFA) par établissement et par semaine**. Les synthèses du lundi passent par l’envoi par lots de l’API (50 % moins cher) : ≈ 15 FCFA. Pour 100 établissements : environ 6 000 FCFA par mois.
- Réponse suggérée : moins de 5 FCFA l’une.
- Le coût est suivi par établissement dans la console de la startup.

**Fini quand** : la synthèse du lundi d’un établissement test regroupe correctement 50 commentaires réels en thèmes, sans aucune donnée nominative dans la requête envoyée (vérifié dans le journal).

## D5 · WhatsApp et vrais SMS — *1,5 semaine (+ délais des fournisseurs)*

**Vrais SMS**
- Branchement d’un fournisseur (au choix : agrégateur ivoirien, Orange, MTN, ou international type Infobip, Twilio), avec nom d’expéditeur « LERENA » ou au nom de l’établissement.
- Réponses « STOP » reçues et appliquées automatiquement (déjà prêt côté Lerena).
- **Décompte réel** : un SMS long ou avec accents compte pour le nombre de parties facturées par l’opérateur (règle corrigée), affiché avant chaque envoi.

**WhatsApp Business**
- Compte WhatsApp Business de Lerena (via Meta directement ou un fournisseur agréé), modèles de messages validés par Meta : rappel de rendez-vous, ticket bientôt appelé, suivi, campagne, rapport du DG.
- Canal choisi automatiquement : WhatsApp si le visiteur l’a, sinon SMS.
- **Boîte « Conversations »** par établissement : les réponses des visiteurs (WhatsApp et SMS) arrivent sur leur fiche et dans une boîte commune, avec pastille, attribution à un membre de l’équipe et réponses rapides.
- Rapport du lundi et alertes envoyés sur le WhatsApp du DG.

**Fini quand** : un visiteur reçoit son rappel de rendez-vous sur WhatsApp, répond « je serai en retard », et la réponse apparaît dans la boîte de l’accueil.

---

## Forfaits proposés

| Fonction | Essentiel | Pro | Entreprise |
|---|---|---|---|
| D1 Rapport du lundi et alertes | Rapport seul | ✓ | ✓ |
| D2 Vue multi-sites et classement des agents | — | ✓ (plusieurs sites) | ✓ + espace réseau |
| D3 Valeur en FCFA, clients à risque, avant / après | — | ✓ | ✓ |
| D4 Synthèse IA et réponses suggérées | — | ✓ | ✓ |
| D5 WhatsApp | — | Option payante (par message) | ✓ (quota inclus) |

## Calendrier

| Semaine | Étape | En parallèle, de votre côté |
|---|---|---|
| 1 | D1 Rapport et alertes | Ouvrir les comptes SMS et WhatsApp Business (validation Meta : quelques jours) ; créer la clé API Anthropic |
| 2 – 3 | D2 Vue direction et classement | |
| 4 | D3 Valeur en FCFA | |
| 5 | D4 Synthèse IA | |
| 6 – 7 | D5 WhatsApp et SMS | Valider les modèles WhatsApp |

Chaque étape : en ligne sur l’environnement de test, guide intégré mis à jour, test de bout en bout, puis la suivante.

## Mesures de réussite (après 1 mois)
- 80 % des DG inscrits ouvrent le rapport du lundi.
- Alertes : moins de 1 fausse alerte sur 5 (sinon les seuils sont ajustés).
- La synthèse IA est jugée juste par le responsable dans 4 cas sur 5 (bouton « utile / pas utile »).
- Au moins 1 client à risque relancé sur 3 revient dans le mois.

## Décisions à valider
1. Le périmètre et l’ordre D1 → D5.
2. Le fournisseur SMS et le fournisseur WhatsApp (ou je vous fais une comparaison chiffrée).
3. L’usage de l’API Claude d’Anthropic pour la synthèse, avec données anonymisées et mention au registre ARTCI.
4. La répartition par forfait.
5. Les seuils d’alerte par défaut (attente 45 min, file de 30 personnes, 3 avis négatifs par heure).
