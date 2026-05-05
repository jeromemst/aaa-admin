import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const enabled = searchParams.get('enabled')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (enabled === 'true') where.enabled = true
  if (enabled === 'false') where.enabled = false

  const [settings, total] = await Promise.all([
    prisma.autoPaySetting.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        policy: {
          select: {
            policyNumber: true,
            status: true,
            plan: { select: { name: true, type: true, premium: true } },
          },
        },
        paymentMethod: {
          select: { brand: true, last4: true, expMonth: true, expYear: true },
        },
      },
    }),
    prisma.autoPaySetting.count({ where }),
  ])

  const enabledCount = await prisma.autoPaySetting.count({ where: { enabled: true } })
  const disabledCount = await prisma.autoPaySetting.count({ where: { enabled: false } })

  return NextResponse.json({
    settings,
    summary: { enabled: enabledCount, disabled: disabledCount },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
