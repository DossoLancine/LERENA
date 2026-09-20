import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { name, phone, password } = await req.json()

    if (!name || !phone || !password) {
      return NextResponse.json({ message: 'Informations manquantes' }, { status: 400 })
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
        name,
        phone,
        password: hashedPassword,
        role: 'CLIENT'
      }
    })

    return NextResponse.json({ message: 'Utilisateur créé', userId: user.id }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: 'Erreur lors de la création du compte' }, { status: 500 })
  }
}
