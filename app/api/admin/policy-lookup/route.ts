import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const policyNumber = searchParams.get('policyNumber')?.trim()

  if (!policyNumber) {
    return NextResponse.json({ error: 'policyNumber query param is required' }, { status: 400 })
  }

  const policy = await prisma.policy.findFirst({
    where: { policyNumber: { equals: policyNumber, mode: 'insensitive' } },
    include: {
      plan: true,
      member: {
        include: {
          paymentMethods: { orderBy: { createdAt: 'desc' } },
        },
      },
      autoPaySetting: {
        include: {
          paymentMethod: true,
        },
      },
      billingHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  // Strip password hash
  const { passwordHash: _pw, ...safeMember } = policy.member

  return NextResponse.json({
    policy: {
      ...policy,
      member: safeMember,
    },
  })
}
