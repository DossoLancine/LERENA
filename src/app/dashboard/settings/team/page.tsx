'use client'

import {
  Trash2,
  UserPlus
} from 'lucide-react'
import { useSettings } from '../_components/settings-provider'

export default function TeamSettingsPage() {
  const { org, showAddMemberModal, setShowAddMemberModal, newMember, setNewMember, createdCredentials, setCreatedCredentials, addingMember, handleAddMember, handleRemoveMember } = useSettings()

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Équipe & Guichetiers</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gérez les collaborateurs habilités à appeler et traiter les tickets depuis l'espace Agent (`/agent`).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-600 transition-all shadow-md shadow-orange-200"
        >
          <UserPlus size={15} />
          Ajouter un Collaborateur
        </button>
      </div>

      {/* Identifiants provisoires du compte qui vient d'être créé : affichés une seule fois */}
      {createdCredentials && (
        <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-bold">Compte créé pour {createdCredentials.name}</p>
          <p className="mt-1">Transmettez-lui ces identifiants ; ils ne seront plus affichés.</p>
          <p className="mt-2 font-mono">{createdCredentials.email}</p>
          <p className="font-mono text-base font-bold tracking-wider">{createdCredentials.password}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(`${createdCredentials.email}
${createdCredentials.password}`)} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-green-800 border border-green-200">Copier</button>
            <button type="button" onClick={() => setCreatedCredentials(null)} className="rounded-xl px-3 py-1.5 text-xs font-bold text-green-800">J’ai transmis</button>
          </div>
        </div>
      )}

      {/* Liste des membres */}
      <div className="divide-y divide-gray-100">
        {org?.members?.map((member: any) => (
          <div key={member.id} className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold ${
                member.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {member.user?.name?.slice(0, 2).toUpperCase() || 'AG'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm">{member.user?.name || 'Collaborateur'}</p>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                    member.role === 'MANAGER'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>
                    {member.role === 'MANAGER' ? 'DIRECTEUR' : member.role === 'RECEPTION' ? 'ACCUEIL' : 'GUICHETIER / AGENT'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {member.user?.email} {member.user?.phone ? `· ${member.user.phone}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {member.role !== 'MANAGER' && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id, member.user?.name)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Retirer de l'équipe"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modale d'ajout d'agent */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Nouveau collaborateur</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newMember.name}
                  onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Awa Traoré"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email professionnel *</label>
                <input
                  type="email"
                  required
                  value={newMember.email}
                  onChange={e => setNewMember(m => ({ ...m, email: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: awa@attends.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={newMember.phone}
                  onChange={e => setNewMember(m => ({ ...m, phone: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: +225 05 00 00 00 00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mot de passe provisoire</label>
                <input
                  type="text"
                  value={newMember.password}
                  onChange={e => setNewMember(m => ({ ...m, password: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Rôle assigné</label>
                <select
                  value={newMember.role}
                  onChange={e => setNewMember(m => ({ ...m, role: e.target.value as any }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="RECEPTION">Agent d'accueil (Accès /reception)</option>
                  <option value="AGENT">Guichetier / Agent (Accès /agent)</option>
                  <option value="MANAGER">Manager / Administrateur (Accès complet /dashboard)</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {addingMember ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
