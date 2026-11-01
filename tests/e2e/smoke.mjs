// Test de fumée de bout en bout, en LECTURE SEULE : aucun ticket, appareil ou compte n'est créé.
// Vérifie que les pages clés s'affichent sans erreur JavaScript et que les en-têtes de sécurité sont présents.
//
//   BASE_URL=https://staging.exemple.ci npm run test:smoke
//   Facultatif : SMOKE_EMAIL / SMOKE_PASSWORD (compte responsable) pour parcourir le tableau de bord,
//                CHROME_PATH pour choisir le navigateur (Chrome ou Edge).

import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].filter(Boolean)
const executablePath = CANDIDATES.find(p => existsSync(p))

const PUBLIC_PAGES = ['/', '/explore', '/auth/login', '/pro/login', '/auth/forgot', '/tickets']
const MANAGER_PAGES = ['/dashboard', '/dashboard/queue', '/dashboard/agenda', '/dashboard/analytics', '/dashboard/settings/site', '/dashboard/settings/priorities', '/dashboard/settings/notifications', '/dashboard/settings/guide']
const SECURITY_HEADERS = ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy']

const failures = []
const fail = (msg) => { failures.push(msg); console.log('  ✗', msg) }
const pass = (msg) => console.log('  ✓', msg)
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function visit(page, path) {
  const errors = []
  const onError = e => errors.push(e.message)
  page.on('pageerror', onError)
  const res = await page.goto(BASE + path, { waitUntil: 'load', timeout: 60_000 })
  await wait(2500)
  page.off('pageerror', onError)
  const status = res?.status() ?? 0
  const text = await page.evaluate(() => document.body.innerText)
  if (status >= 400) fail(`${path} répond ${status}`)
  else if (/Application error|a rencontré un problème/i.test(text)) fail(`${path} affiche une page d'erreur`)
  else if (errors.length) fail(`${path} : erreur JavaScript « ${errors[0].slice(0, 120)} »`)
  else pass(`${path}`)
}

;(async () => {
  if (!executablePath) throw new Error('Aucun navigateur trouvé : définissez CHROME_PATH')
  console.log(`Test de fumée sur ${BASE}`)

  const head = await fetch(BASE + '/explore')
  console.log('En-têtes de sécurité')
  for (const h of SECURITY_HEADERS) (head.headers.get(h) ? pass : fail)(h)
  const version = await fetch(BASE + '/api/version').then(r => r.json()).catch(() => null)
  ;(version?.version ? pass : fail)('version en ligne exposée (/api/version)')

  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  console.log('Pages publiques')
  for (const p of PUBLIC_PAGES) await visit(page, p)

  if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
    console.log('Espace responsable')
    await page.goto(BASE + '/pro/login', { waitUntil: 'load' })
    await page.waitForSelector('#pro-email', { timeout: 60_000 })
    await page.type('#pro-email', process.env.SMOKE_EMAIL)
    await page.type('#pro-password', process.env.SMOKE_PASSWORD)
    await page.click('button[type=submit]')
    try {
      await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 60_000 })
      pass('connexion responsable')
      for (const p of MANAGER_PAGES) await visit(page, p)
    } catch {
      fail('connexion responsable impossible')
    }
  } else {
    console.log('(espace responsable non testé : SMOKE_EMAIL / SMOKE_PASSWORD absents)')
  }

  await browser.close()
  if (failures.length) {
    console.log(`\n${failures.length} échec(s)`)
    process.exit(1)
  }
  console.log('\nTout est vert')
})().catch(e => { console.error('ERREUR', e.message); process.exit(1) })
