'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, Lock, Palette, Trash2 } from 'lucide-react'
import { getBranding, saveBranding } from '@/server/actions/branding'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { OrgMark } from '@/components/branding/org-mark'
import { cn } from '@/lib/cn'

const PRESETS = ['#c2410c', '#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#15803d', '#0369a1', '#111827']

/** Image réduite à 256 px de côté maximum, en WebP (PNG si le navigateur ne sait pas), pour rester légère. */
async function shrink(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url })
    const scale = Math.min(1, 256 / Math.max(img.width, img.height))
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) })
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const webp = canvas.toDataURL('image/webp', 0.85)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Logo et couleur de l'établissement, avec aperçu de l'écran TV et du ticket. */
export function BrandingCard() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof getBranding>>>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getBranding().then(setData) }, [])
  if (!data) return <div className="h-48 rounded-3xl shimmer" />

  const save = async (patch: { logo?: string | null; brandColor?: string | null }, ok: string) => {
    setBusy(true)
    const res = await saveBranding(patch)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setData(d => d && { ...d, ...patch })
    toast(ok)
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('Choisissez une image', 'error')
    try {
      await save({ logo: await shrink(file) }, 'Logo enregistré : il apparaît sur la TV, la borne et les tickets')
    } catch {
      toast('Image illisible', 'error')
    }
  }

  return (
    <Card className="overflow-hidden rounded-3xl">
      <CardHeader title={<span className="flex items-center gap-2"><Palette size={17} className="text-brand" /> Logo et couleur</span>} subtitle="Affichés sur l’écran TV, la borne, le ticket de vos visiteurs et votre fiche" />
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Logo</p>
            <div className="flex flex-wrap items-center gap-3">
              <OrgMark name={data.name} logo={data.logo} color={data.brandColor} size={64} />
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} aria-label="Choisir un logo" />
              <Button variant="secondary" size="sm" icon={<ImagePlus size={15} />} loading={busy} onClick={() => input.current?.click()}>{data.logo ? 'Changer' : 'Ajouter un logo'}</Button>
              {data.logo && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="text-danger" onClick={() => save({ logo: null }, 'Logo retiré')}>Retirer</Button>}
            </div>
            <p className="mt-1.5 text-xs text-ink-subtle">PNG ou JPEG, fond transparent de préférence. L’image est réduite automatiquement.</p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Couleur {!data.canColor && <Lock size={12} aria-label="Forfait Entreprise" />}</p>
            <div className={cn('flex flex-wrap items-center gap-2', !data.canColor && 'pointer-events-none opacity-40')} role="radiogroup" aria-label="Couleur de marque">
              {PRESETS.map(c => (
                <button key={c} type="button" role="radio" aria-checked={(data.brandColor ?? '#c2410c') === c} aria-label={c} onClick={() => save({ brandColor: c === '#c2410c' ? null : c }, 'Couleur enregistrée')}
                  className={cn('h-9 w-9 rounded-full ring-offset-2 transition-transform hover:scale-110', (data.brandColor ?? '#c2410c') === c && 'ring-2 ring-ink')} style={{ background: c }} />
              ))}
              <label className="flex h-9 items-center gap-2 rounded-full border border-gray-200 px-3 text-xs text-ink-muted">
                Autre <input type="color" value={data.brandColor ?? '#c2410c'} onChange={e => setData(d => d && { ...d, brandColor: e.target.value })} onBlur={e => save({ brandColor: e.target.value }, 'Couleur enregistrée')} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Couleur personnalisée" />
              </label>
            </div>
            {!data.canColor && <p className="mt-1.5 text-xs text-ink-subtle">Couleur personnalisée : forfait Entreprise. <Link href="/dashboard/billing" className="font-semibold text-brand">Voir les forfaits</Link></p>}
          </div>
        </div>

        {/* Aperçu */}
        <div className="rounded-2xl bg-gray-950 p-3 text-white shadow-inner" aria-hidden="true">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-white/40">Aperçu écran TV</p>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
            <OrgMark name={data.name} logo={data.logo} color={data.brandColor} size={32} />
            <span className="truncate text-sm font-bold">{data.name}</span>
          </div>
          <div className="mt-2 rounded-xl p-3 text-center" style={{ background: data.brandColor ?? '#c2410c' }}>
            <p className="text-[10px] uppercase tracking-widest text-white/80">Ticket appelé</p>
            <p className="text-3xl font-black">A042</p>
            <p className="text-xs text-white/90">Guichet 2</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
