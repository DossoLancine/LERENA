import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { passwordProblem } from '@/lib/password-policy'
import { HOUR, rateLimit, requestIp } from '@/lib/rate-limit'
import { TERMS_VERSION } from '@/app/legal/content'

export async function POST(req: Request) {
  try {
    const { name, phone, password, acceptTerms } = await req.json()

    const ip = requestIp()
    if (ip && !(await rateLimit(`register:${ip}`, 10, HOUR))) {
      return NextResponse.json({ message: 'Trop d’inscriptions depuis cet appareil : réessayez plus tard.' }, { status: 429 })
    }
    if (acceptTerms !== true) {
      return NextResponse.json({ message: 'Acceptez les conditions d’utilisation et la politique de confidentialité' }, { status: 400 })
    }

    if (!name || !phone || !password) {
      return NextResponse.json({ message: 'Informations manquantes' }, { status: 400 })
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80) {
      return NextResponse.json({ message: 'Indiquez votre nom' }, { status: 400 })
    }
    // Code PIN d'au moins 6 chiffres (ou mot de passe de 8 caractères)
    const problem = passwordProblem(String(password), 'CLIENT')
    if (problem) {
      return NextResponse.json({ message: problem }, { status: 400 })
    }

    const existingUser = await prisma.user.findFirst({
      where: { phone }
    })

    if (existingUser) {
      return NextResponse.json({ message: 'Ce numéro est déjà utilisé' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone,
        password: hashedPassword,
        role: 'CLIENT',
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION
      }
    })

    return NextResponse.json({ message: 'Utilisateur créé', userId: user.id }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: 'Erreur lors de la création du compte' }, { status: 500 })
  }
}
