'use client'

/** Identifiants provisoires d'un compte créé : affichés une seule fois, à transmettre à la personne. */
export function CredentialsNotice({ email, password, onDone }: { email: string; password: string | null; onDone: () => void }) {
  return (
    <div role="status" className="rounded-2xl border border-green-200 bg-success-soft p-4 text-sm text-success-ink">
      {password ? (
        <>
          <p className="font-bold">Compte créé — transmettez ces identifiants, ils ne seront plus affichés.</p>
          <p className="mt-2 font-mono">{email}</p>
          <p className="font-mono text-base font-bold tracking-wider">{password}</p>
        </>
      ) : (
        <p className="font-bold">Le compte existant {email} a été rattaché ; son mot de passe reste inchangé.</p>
      )}
      <div className="mt-3 flex gap-2">
        {password && (
          <button type="button" onClick={() => navigator.clipboard?.writeText(`${email}\n${password}`)}
            className="rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-bold">Copier</button>
        )}
        <button type="button" onClick={onDone} className="rounded-xl px-3 py-1.5 text-xs font-bold">Fermer</button>
      </div>
    </div>
  )
}
