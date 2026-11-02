// Test de charge en lecture seule (k6) : visiteurs qui consultent un établissement et écrans TV qui se rafraîchissent.
// Ne crée aucun ticket : utilisable sur la production.
//
//   k6 run -e BASE_URL=https://lerena1.vercel.app -e ORG_ID=<id> tests/load/public-pages.js
//
// Profil : 50 établissements actifs ≈ 50 écrans TV (une requête toutes les 5 s) + visiteurs qui suivent leur ticket.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.BASE_URL || 'http://localhost:3000'
const ORG = __ENV.ORG_ID

export const options = {
  scenarios: {
    visiteurs: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 40 }, { duration: '1m', target: 40 }, { duration: '20s', target: 0 }], exec: 'visitor' },
    ecrans: { executor: 'constant-vus', vus: 50, duration: '1m50s', exec: 'screen' }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // moins de 1 % d'erreurs
    'http_req_duration{kind:page}': ['p(95)<2000'], // 95 % des pages en moins de 2 s
    'http_req_duration{kind:api}': ['p(95)<800']
  }
}

export function visitor() {
  const pages = ['/explore', ORG ? `/org/${ORG}` : '/', '/api/health']
  for (const p of pages) {
    const res = http.get(BASE + p, { tags: { kind: p.startsWith('/api') ? 'api' : 'page' } })
    check(res, { 'statut 200': r => r.status === 200 })
    sleep(1 + Math.random() * 2)
  }
}

export function screen() {
  const res = http.get(`${BASE}/api/health`, { tags: { kind: 'api' } })
  check(res, { 'santé ok': r => r.status === 200 })
  sleep(5)
}
