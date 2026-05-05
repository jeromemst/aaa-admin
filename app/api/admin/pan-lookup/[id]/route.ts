import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

const patchSchema = z.object({
  cardType: z.enum(['CREDIT', 'DEBIT', 'PREPAID']),
  note: z.string().optional(),
})

// PATCH /api/admin/pan-lookup/[id]  — change card type
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const { cardType, note } = parsed.data

  const existing = await prisma.paymentMethod.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
  }

  if (existing.cardType === cardType) {
    return NextResponse.json({ error: `Card type is already ${cardType}` }, { status: 400 })
  }

  const [updated] = await prisma.$transaction([
    prisma.paymentMethod.update({
      where: { id: params.id },
      data: { cardType },
    }),
    prisma.cardActivityLog.create({
      data: {
        paymentMethodId: params.id,
        action:          'CARD_TYPE_CHANGED',
        fromValue:       existing.cardType,
        toValue:         cardType,
        performedBy:     admin.email,
        note:            note ?? null,
      },
    }),
  ])

  return NextResponse.json({ paymentMethod: updated })
}

// GET /api/admin/pan-lookup/[id]  — fetch activity log
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const logs = await prisma.cardActivityLog.findMany({
    where: { paymentMethodId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ logs })
}
