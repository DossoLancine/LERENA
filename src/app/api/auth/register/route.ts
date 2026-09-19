import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Informations manquantes' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ message: 'Cet email est déjà utilisé' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CLIENT' // Par défaut
      }
    })

    return NextResponse.json({ message: 'Utilisateur créé', userId: user.id }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: 'Erreur lors de la création du compte' }, { status: 500 })
  }
}
