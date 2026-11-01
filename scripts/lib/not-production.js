// Garde-fou : les scripts de démonstration et de remise à zéro ne tournent JAMAIS sur la base de production.
// La production est désignée par PRODUCTION_DB_REF (identifiant du projet Supabase de production, à définir
// le jour de la mise en production) ou par ATTENDS_ENV=production. La base actuelle est la base de TEST.
const fs = require('fs')
const path = require('path')

const PRODUCTION_DB_REF = process.env.PRODUCTION_DB_REF || ''

// Variables du fichier .env (Prisma les chargerait de toute façon) : le garde-fou doit voir la même base
function loadDotEnv() {
  const file = path.join(process.cwd(), '.env')
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function assertNotProduction(scriptName) {
  loadDotEnv()
  const url = `${process.env.DATABASE_URL || ''} ${process.env.DIRECT_URL || ''}`
  if (!url.trim()) {
    console.error(`⛔ ${scriptName} : DATABASE_URL absent.`)
    process.exit(1)
  }
  if (process.env.ATTENDS_ENV === 'production' || (PRODUCTION_DB_REF && url.includes(PRODUCTION_DB_REF))) {
    console.error(`⛔ ${scriptName} refusé : DATABASE_URL pointe vers la base de PRODUCTION.`)
    console.error('   Ces données de démonstration (mots de passe connus, remises à zéro) sont réservées à la base de test.')
    process.exit(1)
  }
}

module.exports = { assertNotProduction }
