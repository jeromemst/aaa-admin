import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

// GET /api/admin/pan-lookup?token=PD8VHPWF8BPTDD75
export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'token query param is required' }, { status: 400 })
  }

  const pm = await prisma.paymentMethod.findFirst({
    where: { panToken: { equals: token, mode: 'insensitive' } },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          state: true,
          eligibilityStatus: true,
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      autoPaySettings: {
        include: {
          policy: {
            select: {
              policyNumber: true,
              status: true,
              plan: { select: { name: true, type: true } },
            },
          },
        },
      },
    },
  })

  if (!pm) {
    return NextResponse.json({ error: 'No card found for that PAN token' }, { status: 404 })
  }

  return NextResponse.json({ paymentMethod: pm })
}
