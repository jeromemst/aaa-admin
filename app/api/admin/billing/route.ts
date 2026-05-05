import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25'))
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { member: { email: { contains: search, mode: 'insensitive' } } },
      { member: { firstName: { contains: search, mode: 'insensitive' } } },
      { member: { lastName: { contains: search, mode: 'insensitive' } } },
      { policy: { policyNumber: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [records, total, aggregates] = await Promise.all([
    prisma.billingHistory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        policy: { select: { policyNumber: true, plan: { select: { name: true, type: true } } } },
      },
    }),
    prisma.billingHistory.count({ where }),
    prisma.billingHistory.aggregate({
      _sum: { amount: true },
      where: { ...where, status: 'SUCCEEDED' },
    }),
  ])

  return NextResponse.json({
    records,
    totalSucceeded: aggregates._sum.amount ?? 0,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
