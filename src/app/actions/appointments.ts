'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createAppointment(orgId: string, serviceId: string, scheduledDate: Date) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id

  if (!userId) return { success: false, error: 'Unauthorized' }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { branches: true }
  })
  
  if (!org || org.branches.length === 0) {
    return { success: false, error: 'Organization not found' }
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: orgId,
        serviceId: serviceId,
        branchId: org.branches[0].id,
        userId: userId,
        scheduledDate: new Date(scheduledDate),
        status: 'CONFIRMED'
      }
    })
    
    revalidatePath(`/dashboard`)
    revalidatePath(`/org/${orgId}`)
    
    return { success: true, appointment }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to create appointment' }
  }
}

export async function getAppointments(orgId: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { name: true, phone: true } },
        service: { select: { name: true } }
      },
      orderBy: { scheduledDate: 'asc' }
    })
    return { success: true, appointments }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to fetch appointments' }
  }
}

export async function updateAppointmentStatus(id: string, status: string) {
  try {
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status }
    })
    revalidatePath(`/dashboard`)
    return { success: true, updated }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to update status' }
  }
}
