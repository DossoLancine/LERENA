import Link from 'next/link'
import { cn } from '@/lib/cn'

/** Liens vers les documents légaux, en bas des pages publiques. */
export function LegalLinks({ className, pro }: { className?: string; pro?: boolean }) {
  const links: [string, string][] = [
    ['/legal/cgu', 'CGU'],
    ...(pro ? [['/legal/cgv', 'CGV'] as [string, string], ['/legal/sous-traitance', 'Sous-traitance'] as [string, string]] : []),
    ['/legal/confidentialite', 'Confidentialité'],
    ['/legal/mentions-legales', 'Mentions légales']
  ]
  return (
    <nav aria-label="Informations légales" className={cn('flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-subtle', className)}>
      {links.map(([href, label]) => <Link key={href} href={href} className="hover:text-ink hover:underline">{label}</Link>)}
    </nav>
  )
}
