# ATTENDS

> **Ne perdez plus votre temps à attendre.**

Plateforme PWA de gestion intelligente des files d'attente.

## Stack technique

- **Frontend** : Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Base de données** : SQLite + Prisma ORM
- **Auth** : NextAuth.js
- **PWA** : manifest.json + service worker

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Initialiser la base de données
npm run db:push

# 3. Lancer en développement
npm run dev
```

L'application sera disponible sur **http://localhost:3000**

## Variables d'environnement

Copier `.env.local` (déjà configuré pour le développement local) :

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="votre-secret-ici"
NEXTAUTH_URL="http://localhost:3000"
```

## Pages disponibles

| URL | Description |
|---|---|
| `/` | Accueil — recherche d'établissements |
| `/explore` | Explorer tous les établissements |
| `/org/[id]` | Fiche établissement + sélection service |
| `/ticket/[id]` | Suivi ticket en temps réel |
| `/tickets` | Mes tickets & historique |
| `/favorites` | Mes établissements favoris |
| `/profile` | Profil utilisateur |
| `/agent` | Interface agent (appel file) |
| `/dashboard` | Dashboard établissement |

## Architecture

```
src/
├── app/              # Pages Next.js App Router
├── lib/
│   ├── prisma.ts     # Client Prisma singleton
│   ├── cn.ts         # Utilitaire Tailwind
│   └── wait-estimator.ts  # Moteur estimation temps d'attente
└── prisma/
    └── schema.prisma # Schéma base de données
```

## Moteur d'estimation

Le moteur `wait-estimator.ts` calcule une fourchette de temps d'attente :

```
estimated_wait = (position × avg_duration_weighted) / active_agents
```

- Pondération 60% médiane + 40% moyenne (résistant aux valeurs aberrantes)
- Variance ±20% pour afficher une fourchette réaliste
- Niveau de confiance : HIGH / MEDIUM / LOW selon les données disponibles
