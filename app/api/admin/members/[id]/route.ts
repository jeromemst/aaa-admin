import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      policies: {
        include: {
          plan: true,
          autoPaySetting: {
            include: { paymentMethod: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      paymentMethods: {
        orderBy: { createdAt: 'desc' },
      },
      billingHistory: {
        include: {
          policy: { select: { policyNumber: true, plan: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Don't expose passwordHash
  const { passwordHash: _pw, ...safeM } = member

  return NextResponse.json({ member: safeM })
}
