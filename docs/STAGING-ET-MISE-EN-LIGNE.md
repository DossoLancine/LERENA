# Environnement de test (staging) et procédure de mise en ligne

> Objectif : ne plus jamais tester sur la base de production (tickets de test, compteurs à remettre, comptes de démo).

## 1. Créer l'environnement de test (une seule fois, ~20 minutes)

### a. Base de test — Supabase
1. Sur supabase.com : **New project** → nom `attends-staging`, région **eu-north-1** (comme la production), mot de passe fort.
2. *Project Settings → Database → Connection string* : noter l'URL **pooler** (`DATABASE_URL`, port 6543, `?pgbouncer=true`) et l'URL **directe** (`DIRECT_URL`, port 5432).
3. *Project Settings → API* : noter l'URL du projet et la clé publique (temps réel).

### b. Schéma et données de démonstration
Dans un terminal, à la racine du projet, avec les variables de la base de **test** :

```bash
DATABASE_URL="…staging…" DIRECT_URL="…staging…" npx prisma migrate deploy
```

```bash
DATABASE_URL="…staging…" DIRECT_URL="…staging…" npm run db:seed:staging
```

Les scripts de démonstration **refusent de tourner sur la production** (garde-fou `scripts/lib/not-production.js`).

### c. Site de test — Vercel
1. Créer un second projet Vercel `attends-staging` relié au même dépôt GitHub, **branche de production : `staging`**.
2. Variables d'environnement : celles de la base de test, un `NEXTAUTH_SECRET` **différent** de la production, `NEXTAUTH_URL` = adresse du site de test, mêmes clés VAPID (ou une paire dédiée).

### d. Intégration continue — secrets GitHub
Dans GitHub : *Settings → Secrets and variables → Actions* :

| Secret | Valeur |
|---|---|
| `STAGING_DATABASE_URL` | URL pooler de la base de test (active le build complet) |
| `STAGING_DIRECT_URL` | URL directe de la base de test |
| `STAGING_URL` | adresse du site de test (active le test de fumée) |
| `SMOKE_EMAIL` / `SMOKE_PASSWORD` | un compte responsable **de la base de test** |

## 2. Procédure de mise en ligne

```
branche de travail ──► staging ──(tests verts + vérification)──► main ──► production
```

1. Développer sur une branche `dev/…`.
2. Fusionner dans `staging` : GitHub vérifie le typage, les tests unitaires, le build, puis le test de fumée sur le site de test.
3. Vérifier à la main le changement sur le site de test.
4. Fusionner `staging` dans `main` : mise en production.
5. Lancer le test de fumée sur la production (lecture seule) :

```bash
BASE_URL=https://lerena1.vercel.app npm run test:smoke
```

### Variable de production

Sur le projet Vercel de **production** uniquement : . Elle rend la double authentification obligatoire pour les super-administrateurs et les administrateurs de réseau (sans elle, simple bandeau de rappel), désactive les SMS simulés et protège la base contre les scripts de démonstration.  ou  force ce réglage indépendamment.

### Variable de production

Sur le projet Vercel de **production** uniquement : `ATTENDS_ENV=production`. Elle rend la double authentification obligatoire pour les super-administrateurs et les administrateurs de réseau (sans elle, simple bandeau de rappel), désactive les SMS simulés et protège la base contre les scripts de démonstration. `ENFORCE_2FA=1` ou `0` force ce réglage indépendamment.

## 3. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (logique d'aiguillage, sécurité, règles) |
| `npm run test:smoke` | Parcours des pages clés en lecture seule (`BASE_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`) |
| `npm run db:seed:staging` | Données de démonstration sur la base de test (refusé en production) |

## 4. Règles

- **Jamais** de données de test sur la production. Un essai = la base de test.
- Les comptes de démo (`…@attends.com`, mot de passe connu) n'existent que sur la base de test ; en production leurs mots de passe ont été remplacés (P1).
- Une migration de base passe d'abord par la base de test.
