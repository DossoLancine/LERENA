import { describe, expect, it } from 'vitest'
import { ACCESS_ROLES, ALL_PERMISSIONS, effectiveRole, isReadOnly, permissionsOf } from '@/lib/access-catalog'

describe('rôles et droits', () => {
  it('reprise des comptes existants : aucun accès perdu', () => {
    expect(effectiveRole(null, 'MANAGER')).toBe('OWNER')
    expect(effectiveRole(null, 'RECEPTION')).toBe('RECEPTION')
    expect(effectiveRole(null, 'AGENT')).toBe('AGENT')
    expect(effectiveRole('REGIONAL', 'MANAGER')).toBe('REGIONAL')
    expect(effectiveRole('INCONNU', 'AGENT')).toBe('AGENT')
    expect(permissionsOf('OWNER')).toEqual(ALL_PERMISSIONS)
  })

  it('un rôle sur mesure ne dépasse jamais son rôle de base', () => {
    const custom = { baseRole: 'RECEPTION', permissions: ['visitors.view', 'billing.manage', 'team.manage'] }
    expect(permissionsOf('RECEPTION', custom)).toEqual(['visitors.view'])
  })

  it('le comptable ne voit aucune donnée de visiteur ; l’auditeur est en lecture seule', () => {
    expect(ACCESS_ROLES.ACCOUNTANT.permissions.some(p => p.startsWith('visitors.'))).toBe(false)
    expect(isReadOnly(ACCESS_ROLES.AUDITOR.permissions)).toBe(true)
    expect(isReadOnly(ACCESS_ROLES.SITE_MANAGER.permissions)).toBe(false)
  })

  it('le DG ne change pas l’abonnement ; seuls les rôles de direction ont des droits d’équipe', () => {
    expect(ACCESS_ROLES.DG.permissions).not.toContain('billing.manage')
    expect(ACCESS_ROLES.DG.permissions).toContain('billing.view')
    for (const r of ['RECEPTION', 'AGENT', 'CASHIER', 'ACCOUNTANT', 'AUDITOR'] as const) expect(ACCESS_ROLES[r].permissions).not.toContain('team.manage')
  })
})
