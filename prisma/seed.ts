/**
 * Seed script — pre-creates all test fixtures for Scene 3 demo scenarios.
 *
 * Test Cases:
 *  TC-1  AutoPay Inquiry – Active Member      → policy WVH700001000, AutoPay Active
 *  TC-2  AutoPay Inquiry – Blocked Member     → EligibilityStatus=4, blocked banner + tooltip
 *  TC-3  PAN Maintenance – Card Type Change   → token PD8VHPWF8BPTDD75, CREDIT→DEBIT, activity log
 *  TC-4  AutoPay Setup – CA Credit Card Rejection → CAC product + CA member + CREDIT card → rejected
 *
 * Run:  cd admin-portal && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const HASH = bcrypt.hashSync('Test@123', 10)
const NOW  = new Date()
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }

async function main() {
  console.log('🌱  Seeding Scene 3 test fixtures…\n')

  // ─────────────────────────────────────────────────────────────────────────
  // PLANS
  // ─────────────────────────────────────────────────────────────────────────

  const lifePlan = await prisma.insurancePlan.upsert({
    where:  { id: 'seed-plan-life-std-001' },
    update: {},
    create: {
      id:              'seed-plan-life-std-001',
      name:            'Life Secure Term',
      type:            'LIFE',
      description:     'Standard term life insurance providing financial protection for your family.',
      premium:         29.99,
      coverageAmount:  500000,
      deductible:      0,
      billingCycle:    'MONTHLY',
      features:        ['$500,000 death benefit', 'Level premiums for 20 years', 'Portable coverage', 'No medical exam required'],
      isActive:        true,
      productCode:     'LST',
    },
  })

  // TC-4 plan: California product — credit cards not accepted
  const cacPlan = await prisma.insurancePlan.upsert({
    where:  { id: 'seed-plan-cac-auto-001' },
    update: {},
    create: {
      id:              'seed-plan-cac-auto-001',
      name:            'California Auto Shield',
      type:            'AUTO',
      description:     'Comprehensive auto coverage for California residents. Debit card required per CA regulation.',
      premium:         89.50,
      coverageAmount:  100000,
      deductible:      500,
      billingCycle:    'MONTHLY',
      features:        ['Collision & comprehensive', 'Uninsured motorist', 'Roadside assistance', 'Rental reimbursement'],
      isActive:        true,
      productCode:     'CAC',
      stateRestriction:'CA',
    },
  })

  console.log('  ✔ Plans created')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-1 — AutoPay Inquiry: Active Member
  //         Policy WVH700001000 → AutoPay enabled
  // ─────────────────────────────────────────────────────────────────────────

  const tc1Member = await prisma.member.upsert({
    where:  { email: 'tc1.active@demo.insure' },
    update: { eligibilityStatus: 0, state: 'TX' },
    create: {
      email:             'tc1.active@demo.insure',
      passwordHash:      HASH,
      firstName:         'Alex',
      lastName:          'Johnson',
      phone:             '555-0101',
      eligibilityStatus: 0,
      state:             'TX',
    },
  })

  const tc1Pm = await prisma.paymentMethod.upsert({
    where:  { stripePaymentMethodId: 'pm_seed_tc1_visa_4242' },
    update: { cardType: 'CREDIT' },
    create: {
      memberId:             tc1Member.id,
      stripePaymentMethodId:'pm_seed_tc1_visa_4242',
      last4:               '4242',
      brand:               'visa',
      expMonth:            12,
      expYear:             2027,
      isDefault:           true,
      panToken:            'TC1PANTOKEN4242VISA',
      cardType:            'CREDIT',
    },
  })

  const tc1Policy = await prisma.policy.upsert({
    where:  { policyNumber: 'WVH700001000' },
    update: { status: 'ACTIVE' },
    create: {
      policyNumber: 'WVH700001000',
      memberId:     tc1Member.id,
      planId:       lifePlan.id,
      status:       'ACTIVE',
      startDate:    addMonths(NOW, -6),
      renewalDate:  addMonths(NOW, 6),
    },
  })

  // AutoPay enabled for TC-1
  await prisma.autoPaySetting.upsert({
    where:  { policyId: tc1Policy.id },
    update: { enabled: true, paymentMethodId: tc1Pm.id },
    create: {
      memberId:        tc1Member.id,
      policyId:        tc1Policy.id,
      paymentMethodId: tc1Pm.id,
      enabled:         true,
    },
  })

  // Billing history
  for (let i = 5; i >= 0; i--) {
    const d = addMonths(NOW, -i)
    await prisma.billingHistory.upsert({
      where:  { stripePaymentIntentId: `pi_seed_tc1_${i}` },
      update: {},
      create: {
        memberId:             tc1Member.id,
        policyId:             tc1Policy.id,
        amount:               lifePlan.premium,
        status:               'SUCCEEDED',
        description:          `Monthly premium — Life Secure Term`,
        stripePaymentIntentId:`pi_seed_tc1_${i}`,
        paidAt:               d,
        createdAt:            d,
      },
    })
  }

  console.log('  ✔ TC-1  WVH700001000 — Active AutoPay member seeded')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-2 — AutoPay Inquiry: Blocked Member (EligibilityStatus = 4)
  // ─────────────────────────────────────────────────────────────────────────

  const tc2Member = await prisma.member.upsert({
    where:  { email: 'tc2.blocked@demo.insure' },
    update: { eligibilityStatus: 4, state: 'FL' },
    create: {
      email:             'tc2.blocked@demo.insure',
      passwordHash:      HASH,
      firstName:         'Maria',
      lastName:          'Santos',
      phone:             '555-0202',
      eligibilityStatus: 4,
      state:             'FL',
    },
  })

  const tc2Pm = await prisma.paymentMethod.upsert({
    where:  { stripePaymentMethodId: 'pm_seed_tc2_mc_5555' },
    update: {},
    create: {
      memberId:             tc2Member.id,
      stripePaymentMethodId:'pm_seed_tc2_mc_5555',
      last4:               '5555',
      brand:               'mastercard',
      expMonth:            8,
      expYear:             2026,
      isDefault:           true,
      panToken:            'TC2PANTOKEN5555MC00',
      cardType:            'CREDIT',
    },
  })

  const tc2Policy = await prisma.policy.upsert({
    where:  { policyNumber: 'WVH700001001' },
    update: { status: 'ACTIVE' },
    create: {
      policyNumber: 'WVH700001001',
      memberId:     tc2Member.id,
      planId:       lifePlan.id,
      status:       'ACTIVE',
      startDate:    addMonths(NOW, -3),
      renewalDate:  addMonths(NOW, 9),
    },
  })

  // AutoPay disabled — member is blocked
  await prisma.autoPaySetting.upsert({
    where:  { policyId: tc2Policy.id },
    update: { enabled: false, paymentMethodId: tc2Pm.id },
    create: {
      memberId:        tc2Member.id,
      policyId:        tc2Policy.id,
      paymentMethodId: tc2Pm.id,
      enabled:         false,
    },
  })

  console.log('  ✔ TC-2  WVH700001001 — Blocked member (EligibilityStatus=4) seeded')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-3 — PAN Maintenance: Card Type Change
  //         Token PD8VHPWF8BPTDD75, currently CREDIT → will be changed to DEBIT
  // ─────────────────────────────────────────────────────────────────────────

  const tc3Member = await prisma.member.upsert({
    where:  { email: 'tc3.pan@demo.insure' },
    update: { eligibilityStatus: 0, state: 'NY' },
    create: {
      email:             'tc3.pan@demo.insure',
      passwordHash:      HASH,
      firstName:         'David',
      lastName:          'Kim',
      phone:             '555-0303',
      eligibilityStatus: 0,
      state:             'NY',
    },
  })

  const tc3Pm = await prisma.paymentMethod.upsert({
    where:  { stripePaymentMethodId: 'pm_seed_tc3_amex_PD8V' },
    update: { cardType: 'CREDIT', panToken: 'PD8VHPWF8BPTDD75' },
    create: {
      memberId:             tc3Member.id,
      stripePaymentMethodId:'pm_seed_tc3_amex_PD8V',
      last4:               '3782',
      brand:               'amex',
      expMonth:            3,
      expYear:             2028,
      isDefault:           true,
      panToken:            'PD8VHPWF8BPTDD75',
      cardType:            'CREDIT',
    },
  })

  const tc3Policy = await prisma.policy.upsert({
    where:  { policyNumber: 'WVH700001002' },
    update: { status: 'ACTIVE' },
    create: {
      policyNumber: 'WVH700001002',
      memberId:     tc3Member.id,
      planId:       lifePlan.id,
      status:       'ACTIVE',
      startDate:    addMonths(NOW, -2),
      renewalDate:  addMonths(NOW, 10),
    },
  })

  // Pre-seed two historical activity log entries so the history table isn't empty
  const existingLogs = await prisma.cardActivityLog.count({ where: { paymentMethodId: tc3Pm.id } })
  if (existingLogs === 0) {
    await prisma.cardActivityLog.createMany({
      data: [
        {
          paymentMethodId: tc3Pm.id,
          action:          'CARD_ADDED',
          fromValue:       null,
          toValue:         'CREDIT',
          performedBy:     'system@insure',
          note:            'Card enrolled during member onboarding',
          createdAt:       addMonths(NOW, -2),
        },
        {
          paymentMethodId: tc3Pm.id,
          action:          'CARD_TYPE_CHANGED',
          fromValue:       'DEBIT',
          toValue:         'CREDIT',
          performedBy:     'admin@insureportal.com',
          note:            'Corrected card type based on issuer verification',
          createdAt:       addMonths(NOW, -1),
        },
      ],
    })
  }

  console.log('  ✔ TC-3  PAN PD8VHPWF8BPTDD75 — CREDIT card + activity history seeded')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-4 — AutoPay Setup: CA Credit Card Rejection
  //         CAC plan + CA member + CREDIT card → rejected
  // ─────────────────────────────────────────────────────────────────────────

  const tc4Member = await prisma.member.upsert({
    where:  { email: 'tc4.ca@demo.insure' },
    update: { eligibilityStatus: 0, state: 'CA' },
    create: {
      email:             'tc4.ca@demo.insure',
      passwordHash:      HASH,
      firstName:         'James',
      lastName:          'Chen',
      phone:             '555-0404',
      eligibilityStatus: 0,
      state:             'CA',
    },
  })

  const tc4CreditPm = await prisma.paymentMethod.upsert({
    where:  { stripePaymentMethodId: 'pm_seed_tc4_visa_ca_credit' },
    update: { cardType: 'CREDIT' },
    create: {
      memberId:             tc4Member.id,
      stripePaymentMethodId:'pm_seed_tc4_visa_ca_credit',
      last4:               '1111',
      brand:               'visa',
      expMonth:            6,
      expYear:             2026,
      isDefault:           true,
      panToken:            'TC4PANVISA1111CACRED',
      cardType:            'CREDIT',
    },
  })

  // Also give TC-4 a debit card (so the success path can be shown)
  await prisma.paymentMethod.upsert({
    where:  { stripePaymentMethodId: 'pm_seed_tc4_visa_ca_debit' },
    update: { cardType: 'DEBIT' },
    create: {
      memberId:             tc4Member.id,
      stripePaymentMethodId:'pm_seed_tc4_visa_ca_debit',
      last4:               '9999',
      brand:               'visa',
      expMonth:            9,
      expYear:             2027,
      isDefault:           false,
      panToken:            'TC4PANVISA9999CADEBT',
      cardType:            'DEBIT',
    },
  })

  const tc4Policy = await prisma.policy.upsert({
    where:  { policyNumber: 'WVH700001003' },
    update: { status: 'ACTIVE' },
    create: {
      policyNumber: 'WVH700001003',
      memberId:     tc4Member.id,
      planId:       cacPlan.id,
      status:       'ACTIVE',
      startDate:    addMonths(NOW, -1),
      renewalDate:  addMonths(NOW, 11),
    },
  })

  console.log('  ✔ TC-4  WVH700001003 — CA member + CAC plan (credit rejected, debit allowed) seeded')

  console.log('\n✅  All test fixtures seeded successfully.\n')
  console.log('  Test reference:')
  console.log('  ┌─────────────────────────────────────────────────────────────────┐')
  console.log('  │ TC-1  Policy WVH700001000  →  AutoPay ACTIVE                    │')
  console.log('  │ TC-2  Policy WVH700001001  →  EligibilityStatus=4, BLOCKED      │')
  console.log('  │ TC-3  PAN Token PD8VHPWF8BPTDD75  →  Card type CREDIT (change) │')
  console.log('  │ TC-4  Policy WVH700001003  →  CAC plan, CA, credit rejected     │')
  console.log('  └─────────────────────────────────────────────────────────────────┘')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
