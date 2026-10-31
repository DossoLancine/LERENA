// Transition douce à chaque changement de page (désactivée si l'utilisateur réduit les animations)
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
