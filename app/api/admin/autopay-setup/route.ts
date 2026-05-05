import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { adminAuthMiddleware, unauthorized } from '@/lib/auth'

const validateSchema = z.object({
  policyId:        z.string(),
  paymentMethodId: z.string(),
})

// POST /api/admin/autopay-setup  — validate and attempt autopay setup
export async function POST(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const parsed = validateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { policyId, paymentMethodId } = parsed.data

  const [policy, pm] = await Promise.all([
    prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        plan: true,
        member: { select: { id: true, firstName: true, lastName: true, email: true, state: true, eligibilityStatus: true } },
        autoPaySetting: true,
      },
    }),
    prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } }),
  ])

  if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  if (!pm)     return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })

  // ── Validation rules ──────────────────────────────────────────────────────

  // Rule 1: Member eligibility
  if (policy.member.eligibilityStatus === 4) {
    return NextResponse.json({
      allowed: false,
      rejectionCode: 'MEMBER_BLOCKED',
      rejectionMessage: 'AutoPay setup is not permitted. This member has EligibilityStatus=4 (Blocked). Please resolve the account standing before enrolling in AutoPay.',
      details: {
        eligibilityStatus: policy.member.eligibilityStatus,
        rule: 'ELIGIBILITY_BLOCK',
      },
    })
  }

  // Rule 2: CA product — credit cards not accepted
  const isCacProduct  = policy.plan.productCode === 'CAC'
  const isCaRestricted = policy.plan.stateRestriction === 'CA' || policy.member.state === 'CA'
  const isCreditCard  = pm.cardType === 'CREDIT'

  if (isCacProduct && isCaRestricted && isCreditCard) {
    return NextResponse.json({
      allowed: false,
      rejectionCode: 'CA_CREDIT_CARD_REJECTED',
      rejectionMessage: 'Credit cards are not accepted for California (CAC) products. Per California Insurance Code §758.5, AutoPay for this product must be set up with a debit card or bank account.',
      details: {
        productCode:     policy.plan.productCode,
        memberState:     policy.member.state,
        cardType:        pm.cardType,
        rule:            'CA_CREDIT_RESTRICTION',
      },
    })
  }

  // Rule 3: Policy must be active
  if (policy.status !== 'ACTIVE') {
    return NextResponse.json({
      allowed: false,
      rejectionCode: 'POLICY_NOT_ACTIVE',
      rejectionMessage: `AutoPay can only be set up for ACTIVE policies. This policy is ${policy.status}.`,
      details: { policyStatus: policy.status, rule: 'POLICY_STATUS' },
    })
  }

  // Rule 4: AutoPay already enabled
  if (policy.autoPaySetting?.enabled) {
    return NextResponse.json({
      allowed: false,
      rejectionCode: 'AUTOPAY_ALREADY_ACTIVE',
      rejectionMessage: 'AutoPay is already enabled for this policy.',
      details: { rule: 'DUPLICATE_AUTOPAY' },
    })
  }

  // ── All checks passed — create the autopay setting ────────────────────────
  const setting = await prisma.autoPaySetting.upsert({
    where:  { policyId },
    update: { enabled: true, paymentMethodId },
    create: {
      memberId:        policy.member.id,
      policyId,
      paymentMethodId,
      enabled:         true,
    },
  })

  return NextResponse.json({
    allowed: true,
    setting,
    message: `AutoPay successfully enabled for policy ${policy.policyNumber}.`,
  })
}

// GET /api/admin/autopay-setup?memberId=... — fetch member's policies + payment methods for the setup form
export async function GET(req: NextRequest) {
  const admin = adminAuthMiddleware(req)
  if (!admin) return unauthorized()

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  const search   = searchParams.get('search') ?? ''

  if (memberId) {
    // Return member's policies and payment methods
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        policies: {
          where: { status: 'ACTIVE' },
          include: {
            plan: true,
            autoPaySetting: { select: { enabled: true } },
          },
        },
        paymentMethods: true,
      },
    })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    const { passwordHash: _pw, ...safe } = member
    return NextResponse.json({ member: safe })
  }

  if (search) {
    // Search members
    const members = await prisma.member.findMany({
      where: {
        OR: [
          { email:     { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, state: true, eligibilityStatus: true },
      take: 10,
    })
    return NextResponse.json({ members })
  }

  return NextResponse.json({ members: [] })
}
