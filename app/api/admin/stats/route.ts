import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const [
    totalMembers,
    totalPolicies,
    activePolicies,
    cancelledPolicies,
    expiredPolicies,
    autoPayEnabled,
    revenueResult,
    recentPayments,
    policyByType,
    monthlyRevenue,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.policy.count(),
    prisma.policy.count({ where: { status: 'ACTIVE' } }),
    prisma.policy.count({ where: { status: 'CANCELLED' } }),
    prisma.policy.count({ where: { status: 'EXPIRED' } }),
    prisma.autoPaySetting.count({ where: { enabled: true } }),
    prisma.billingHistory.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCEEDED' },
    }),
    prisma.billingHistory.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { status: 'SUCCEEDED' },
      include: {
        member: { select: { firstName: true, lastName: true, email: true } },
        policy: { select: { policyNumber: true, plan: { select: { name: true, type: true } } } },
      },
    }),
    prisma.policy.groupBy({
      by: ['planId'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
    }),
    // Last 6 months revenue
    prisma.$queryRaw<{ month: string; revenue: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
        SUM(amount) as revenue
      FROM "BillingHistory"
      WHERE status = 'SUCCEEDED'
        AND "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
  ])

  // Enrich policyByType with plan info
  const planIds = policyByType.map(p => p.planId)
  const plans = await prisma.insurancePlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true, type: true },
  })
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]))
  const policyTypeBreakdown = policyByType.map(p => ({
    type: planMap[p.planId]?.type ?? 'UNKNOWN',
    name: planMap[p.planId]?.name ?? 'Unknown',
    count: p._count.id,
  }))

  return NextResponse.json({
    totalMembers,
    totalPolicies,
    activePolicies,
    cancelledPolicies,
    expiredPolicies,
    autoPayEnabled,
    totalRevenue: revenueResult._sum.amount ?? 0,
    recentPayments,
    policyTypeBreakdown,
    monthlyRevenue: monthlyRevenue.map(r => ({
      month: r.month,
      revenue: Number(r.revenue),
    })),
  })
}
