import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const type = searchParams.get('type') ?? ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (status) where.status = status
  if (type) where.plan = { type }
  if (search) {
    where.OR = [
      { policyNumber: { contains: search, mode: 'insensitive' } },
      { member: { firstName: { contains: search, mode: 'insensitive' } } },
      { member: { lastName: { contains: search, mode: 'insensitive' } } },
      { member: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [policies, total] = await Promise.all([
    prisma.policy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true, type: true, premium: true } },
        autoPaySetting: { select: { enabled: true } },
      },
    }),
    prisma.policy.count({ where }),
  ])

  return NextResponse.json({
    policies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
