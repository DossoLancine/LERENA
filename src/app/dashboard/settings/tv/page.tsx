'use client'

import {
  Tv,
  Save,
  ExternalLink,
  Copy,
  Trash2,
  Layers,
  SplitSquareHorizontal,
  Film,
  Info,
  Plus
} from 'lucide-react'
import { useSettings } from '../_components/settings-provider'

export default function TvSettingsPage() {
  const { saving, formData, setFormData, copiedTvUrl, playlist, addPlaylistItem, updatePlaylistItem, removePlaylistItem, handleSaveProfile, copyToClipboard, tvPageUrl } = useSettings()

  return (
    <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Programme des écrans</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ce que montrent toutes les TV de l’établissement : numéros appelés, et vos vidéos ou publicités. Les TV elles-mêmes se connectent dans « Appareils ».
          </p>
        </div>
        <a
          href={tvPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
        >
          <ExternalLink size={15} />
          Lancer l'Écran TV Plein Écran
        </a>
      </div>

      {/* Choix du mode d'affichage TV */}
      <div>
        <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
          Mode de diffusion de la salle d'attente
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
              formData.tvMode === 'HYBRID'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-orange-500" />
                <span className="font-bold text-sm">Alternance Dynamique</span>
              </div>
              <input
                type="radio"
                name="tvMode"
                value="HYBRID"
                checked={formData.tvMode === 'HYBRID'}
                onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                className="w-4 h-4 text-orange-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              Alterne automatiquement entre la file d'attente et votre vidéo/publicité selon les durées configurées.
            </p>
          </label>

          <label
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
              formData.tvMode === 'SPLIT'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SplitSquareHorizontal size={18} className="text-orange-500" />
                <span className="font-bold text-sm">Écran Scindé</span>
              </div>
              <input
                type="radio"
                name="tvMode"
                value="SPLIT"
                checked={formData.tvMode === 'SPLIT'}
                onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                className="w-4 h-4 text-orange-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              Affiche en simultané : 50% file d'attente à gauche et 50% vidéo publicitaire en boucle à droite.
            </p>
          </label>

          <label
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
              formData.tvMode === 'QUEUE_ONLY'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tv size={18} className="text-orange-500" />
                <span className="font-bold text-sm">File Seule</span>
              </div>
              <input
                type="radio"
                name="tvMode"
                value="QUEUE_ONLY"
                checked={formData.tvMode === 'QUEUE_ONLY'}
                onChange={e => setFormData(f => ({ ...f, tvMode: e.target.value }))}
                className="w-4 h-4 text-orange-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              Affiche uniquement les tickets en continu sans interruption vidéo.
            </p>
          </label>
        </div>
      </div>

      {/* Configuration de la Playlist Vidéos & Timing */}
      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-orange-500" />
            <div>
              <h3 className="font-bold text-sm text-gray-900">Playlist Vidéos & Publicités ({playlist.length})</h3>
              <p className="text-[11px] text-gray-500">
                Ajoutez plusieurs vidéos. L'écran Smart TV les enchaînera automatiquement dans l'ordre.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addPlaylistItem}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus size={14} />
            Ajouter une vidéo
          </button>
        </div>

        {/* Liste des vidéos de la playlist */}
        {playlist.length === 0 ? (
          <div className="p-6 bg-white border border-dashed border-gray-200 rounded-2xl text-center">
            <Film size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">Aucune vidéo dans la playlist</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Cliquez sur « Ajouter une vidéo » pour insérer un lien YouTube ou un fichier MP4.
            </p>
            <button
              type="button"
              onClick={addPlaylistItem}
              className="mt-3 inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus size={13} />
              Ajouter ma première vidéo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {playlist.map((item, index) => (
              <div
                key={item.id}
                className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3 hover:border-orange-200 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 text-xs font-mono font-bold flex items-center justify-center">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={e => updatePlaylistItem(item.id, 'title', e.target.value)}
                      placeholder="Titre de la vidéo (ex: Présentation Clinique)"
                      className="text-xs font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-500 focus:outline-none px-1 py-0.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlaylistItem(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                    title="Supprimer cette vidéo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div>
                  <input
                    type="text"
                    value={item.url}
                    onChange={e => updatePlaylistItem(item.id, 'url', e.target.value)}
                    placeholder="Lien YouTube ou direct MP4 (ex: https://www.youtube.com/watch?v=...)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-500">
          Astuce : Si aucune vidéo n'est configurée, la Smart TV diffusera automatiquement vos promotions marketing sous forme de diaporama interactif.
        </p>

        {formData.tvMode === 'HYBRID' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Durée d'affichage de la File d'attente
              </label>
              <select
                value={formData.tvQueueDuration}
                onChange={e => setFormData(f => ({ ...f, tvQueueDuration: parseInt(e.target.value) }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value={15}>15 secondes</option>
                <option value={30}>30 secondes (Recommandé)</option>
                <option value={45}>45 secondes</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Durée d'affichage de la Vidéo / Publicité
              </label>
              <select
                value={formData.tvVideoDuration}
                onChange={e => setFormData(f => ({ ...f, tvVideoDuration: parseInt(e.target.value) }))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value={15}>15 secondes</option>
                <option value={30}>30 secondes (Recommandé)</option>
                <option value={45}>45 secondes</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
              </select>
            </div>
          </div>
        )}

        {/* Note de priorité aux appels */}
        <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Priorité absolue aux appels :</strong> Même si une vidéo ou une publicité tourne, dès qu'un
            guichetier clique sur « Appeler le suivant », l'écran interrompt instantanément la diffusion pour afficher
            le numéro en très grand avec le signal sonore ding-dong et la synthèse vocale !
          </p>
        </div>
      </div>

      {/* Lien TV dédié & Copie */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Lien direct à ouvrir sur la télévision :</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={tvPageUrl}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-600 truncate"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(tvPageUrl, true)}
            className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            <Copy size={13} />
            {copiedTvUrl ? 'Copié !' : 'Copier'}
          </button>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm shadow-md shadow-orange-200 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration TV'}
        </button>
      </div>
    </form>
  )
}
