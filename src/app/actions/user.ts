'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'

export async function updateUserProfile(data: { name?: string; phone?: string; password?: string }) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    throw new Error("Non autorisé")
  }

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.phone !== undefined) updateData.phone = data.phone
  
  // Note: En production, on devrait hasher le mot de passe avec bcrypt
  // Ici pour la maquette on le stocke tel quel si fourni
  if (data.password && data.password.trim() !== '') {
    updateData.password = data.password
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: updateData
  })

  return { success: true }
}

export async function getUserProfile() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
    }
  })

  return user
}
