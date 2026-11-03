import { describe, expect, it, vi } from 'vitest'
import { isNegativeComment, needsAction, isFeedbackReason } from '@/lib/complaints'

// Module serveur : seules les règles de détection sont testées ici (vi.mock est remonté avant l'import)
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/messaging', () => ({ appUrl: () => '', sendEmail: async () => true }))
vi.mock('@/lib/customers', () => ({ refreshCustomersOfTickets: async () => undefined }))

describe('avis à traiter', () => {
  it('une note de 1 ou 2 étoiles est toujours à traiter', () => {
    expect(needsAction(1, null, null)).toBe(true)
    expect(needsAction(2, 'Merci', null)).toBe(true)
  })

  it('un 3 est à traiter seulement avec un motif ou un commentaire négatif', () => {
    expect(needsAction(3, null, null)).toBe(false)
    expect(needsAction(3, 'Correct, rien à dire', null)).toBe(false)
    expect(needsAction(3, null, 'WAIT')).toBe(true)
    expect(needsAction(3, 'Attente beaucoup trop longue', null)).toBe(true)
  })

  it('4 et 5 étoiles ne sont jamais à traiter', () => {
    expect(needsAction(4, 'un peu lent mais bien', 'WAIT')).toBe(false)
    expect(needsAction(5, null, null)).toBe(false)
  })

  it('reconnaît un commentaire négatif, avec ou sans accents', () => {
    expect(isNegativeComment('Accueil désagréable')).toBe(true)
    expect(isNegativeComment('DÉÇU par le service')).toBe(true)
    expect(isNegativeComment('Très bon accueil, merci')).toBe(false)
    expect(isNegativeComment(null)).toBe(false)
  })

  it('motifs acceptés', () => {
    expect(isFeedbackReason('WAIT')).toBe(true)
    expect(isFeedbackReason('toString')).toBe(false)
    expect(isFeedbackReason(undefined)).toBe(false)
  })
})
