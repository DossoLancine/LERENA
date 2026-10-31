'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getSessionUser } from '@/lib/session'

export async function updateUserProfile(data: { name?: string; phone?: string; password?: string; image?: string }) {
  const user = await getSessionUser()
  if (!user) throw new Error("Non autorisé")

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.image !== undefined) updateData.image = data.image
  
  if (data.password && data.password.trim() !== '') {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData
  })

  return { success: true }
}

export async function getUserProfile() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return null

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
    }
  })

  return user
}
