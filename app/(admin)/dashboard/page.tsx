'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import {
  formatCurrency, formatDate,
  getPlanTypeLabel, getInitials,
} from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyLookup {
  id: string
  policyNumber: string
  status: string
  startDate: string
  renewalDate: string
  endDate: string | null
  createdAt: string
  plan: {
    name: string
    type: string
    description: string
    premium: number
    coverageAmount: number
    deductible: number
    billingCycle: string
    features: string[]
    stripePriceId: string | null
    productCode: string | null
    stateRestriction: string | null
  }
  member: {
    id: string
    email: string
    firstName: string
    lastName: string
    phone: string | null
    dateOfBirth: string | null
    stripeCustomerId: string | null
    createdAt: string
    state: string | null
    eligibilityStatus: number
    paymentMethods: {
      id: string
      brand: string
      last4: string
      expMonth: number
      expYear: number
      isDefault: boolean
      cardType: string
      createdAt: string
    }[]
  }
  autoPaySetting: {
    id: string
    enabled: boolean
    stripeSubscriptionId: string | null
    createdAt: string
    updatedAt: string
    paymentMethod: {
      id: string
      brand: string
      last4: string
      expMonth: number
      expYear: number
      cardType: string
      panToken: string | null
      isDefault: boolean
    }
  } | null
  billingHistory: {
    id: string
    amount: number
    status: string
    description: string | null
    paidAt: string | null
    createdAt: string
    stripePaymentIntentId: string | null
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const s = status.toUpperCase()
  if (s === 'ACTIVE' || s === 'SUCCEEDED')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">{status.toLowerCase()}</span>
  if (s === 'CANCELLED' || s === 'FAILED')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">{status.toLowerCase()}</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">{status.toLowerCase()}</span>
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        {badge}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 font-medium text-right">{value}</span>
    </div>
  )
}

// ─── Policy Lookup Panel ──────────────────────────────────────────────────────

function PolicyLookupPanel({ accessToken }: { accessToken: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PolicyLookup | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    fetch(`/api/admin/policy-lookup?policyNumber=${encodeURIComponent(input.trim())}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Not found')
        setResult(data.policy)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  function handleClear() {
    setInput('')
    setResult(null)
    setError('')
    inputRef.current?.focus()
  }

  const totalCollected = result
    ? result.billingHistory.filter(b => b.status === 'SUCCEEDED').reduce((s, b) => s + b.amount, 0)
    : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Policy Lookup</h2>
          <p className="text-xs text-gray-400">Search by policy number to view full insurance &amp; payment details</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-6 py-4 border-b border-gray-100">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              placeholder="e.g. WVH700001000"
              className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {loading
              ? <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />Searching…</>
              : 'Look up'}
          </button>
          {(result || error) && (
            <button type="button" onClick={handleClear} className="text-gray-500 hover:text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors">
              Clear
            </button>
          )}
        </form>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="p-6 space-y-5">

          {/* Policy header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-base font-bold text-gray-900">{result.plan.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                  {getPlanTypeLabel(result.plan.type)}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">{result.policyNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(result.status)}
              <Link
                href={`/members/${result.member.id}`}
                className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                View member →
              </Link>
            </div>
          </div>

          {/* 4-col summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Monthly Premium', value: formatCurrency(result.plan.premium) },
              { label: 'Coverage Amount', value: formatCurrency(result.plan.coverageAmount) },
              { label: 'Deductible', value: formatCurrency(result.plan.deductible) },
              { label: 'Total Collected', value: formatCurrency(totalCollected), highlight: true },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-sm font-bold ${s.highlight ? 'text-blue-600' : 'text-gray-900'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* EligibilityStatus=4 blocked banner */}
          {result.member.eligibilityStatus === 4 && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-red-700">Member Account Blocked — EligibilityStatus 4</p>
                  <div className="relative group">
                    <svg className="w-4 h-4 text-red-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute left-0 top-6 z-20 hidden group-hover:block w-72 bg-white border border-gray-200 rounded-xl p-4 shadow-xl text-xs text-gray-600 leading-relaxed">
                      <p className="font-semibold text-gray-800 mb-2">EligibilityStatus Codes</p>
                      <div className="space-y-1.5">
                        <div className="flex gap-2"><span className="text-emerald-600 font-mono w-4">0</span><span>Active — no restrictions</span></div>
                        <div className="flex gap-2"><span className="text-yellow-600 font-mono w-4">1</span><span>Pending review</span></div>
                        <div className="flex gap-2"><span className="text-orange-500 font-mono w-4">2</span><span>Suspended — limited access</span></div>
                        <div className="flex gap-2"><span className="text-orange-600 font-mono w-4">3</span><span>On notice — action required</span></div>
                        <div className="flex gap-2"><span className="text-red-600 font-mono w-4">4</span><span className="text-red-600">Blocked — AutoPay enrollment and payment changes are disabled until account standing is resolved</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-red-600">
                  AutoPay setup and payment changes are blocked for this account. Resolve the account standing before enabling AutoPay.
                </p>
              </div>
              <span className="text-xs font-mono bg-red-100 text-red-600 border border-red-200 px-2.5 py-1 rounded-full flex-shrink-0">
                STATUS=4
              </span>
            </div>
          )}

          {/* 3-col detail grid */}
          <div className="grid grid-cols-3 gap-4">

            {/* ── Col 1: Policy details ── */}
            <div className="space-y-4">
              <Card title="Policy Dates">
                {[
                  { label: 'Start Date', value: formatDate(result.startDate) },
                  { label: 'Renewal Date', value: formatDate(result.renewalDate) },
                  { label: 'End Date', value: result.endDate ? formatDate(result.endDate) : '—' },
                  { label: 'Enrolled', value: formatDate(result.createdAt) },
                ].map(f => <Row key={f.label} label={f.label} value={f.value} />)}
              </Card>

              <Card title="Plan Features">
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">{result.plan.description}</p>
                <ul className="space-y-1.5">
                  {(Array.isArray(result.plan.features) ? result.plan.features : []).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
                  <span className="text-gray-400">Billing cycle</span>
                  <span className="text-gray-700 font-medium capitalize">{result.plan.billingCycle.toLowerCase()}</span>
                </div>
              </Card>
            </div>

            {/* ── Col 2: Member + Payment methods ── */}
            <div className="space-y-4">
              <Card title="Member">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
                    {getInitials(result.member.firstName, result.member.lastName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{result.member.firstName} {result.member.lastName}</p>
                    <p className="text-xs text-gray-400">{result.member.email}</p>
                  </div>
                </div>
                {[
                  { label: 'Phone', value: result.member.phone ?? '—' },
                  { label: 'DOB', value: formatDate(result.member.dateOfBirth) },
                  { label: 'State', value: result.member.state ?? '—' },
                  { label: 'Member since', value: formatDate(result.member.createdAt) },
                ].map(f => <Row key={f.label} label={f.label} value={f.value} />)}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Eligibility</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border font-medium ${
                    result.member.eligibilityStatus === 4
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : result.member.eligibilityStatus === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {result.member.eligibilityStatus === 0 ? 'Active (0)' : `Status ${result.member.eligibilityStatus}`}
                  </span>
                </div>
              </Card>

              <Card title={`Saved Cards (${result.member.paymentMethods.length})`}>
                {result.member.paymentMethods.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No payment methods on file</p>
                ) : (
                  <div className="space-y-2">
                    {result.member.paymentMethods.map(pm => (
                      <div key={pm.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <div>
                            <p className="text-xs text-gray-800 capitalize font-medium">{pm.brand} •••• {pm.last4}</p>
                            <p className="text-xs text-gray-400">Exp {pm.expMonth}/{pm.expYear}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium border ${
                            pm.cardType === 'CREDIT'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : pm.cardType === 'DEBIT'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>{pm.cardType}</span>
                          {pm.isDefault && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">Default</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Col 3: Auto-pay + Billing ── */}
            <div className="space-y-4">
              {/* Auto-Pay Configuration — full detail card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Auto-Pay Configuration</p>
                  {result.autoPaySetting?.enabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Inactive
                    </span>
                  )}
                </div>

                {!result.autoPaySetting ? (
                  <p className="text-xs text-gray-400 italic">Not configured</p>
                ) : (() => {
                  const ap  = result.autoPaySetting!
                  const pm  = ap.paymentMethod
                  // Parse product prefix + insurance number from policy number
                  // e.g. "WVH700001000" → prefix="WVH", insNum="700001000"
                  const prefixMatch = result.policyNumber.match(/^([A-Za-z]+)(\d+)$/)
                  const productPrefix = prefixMatch ? prefixMatch[1].toUpperCase() : '—'
                  const insuranceNum  = prefixMatch ? prefixMatch[2] : result.policyNumber

                  return (
                    <div className="space-y-4">
                      {/* ── Current AutoPay ── */}
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-2">Current AutoPay</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            { label: 'AutoPay Status',        value: ap.enabled ? 'Autopay Active' : 'Inactive' },
                            { label: 'Product Prefix',        value: productPrefix },
                            { label: 'Insurance #',           value: insuranceNum },
                            { label: 'Source',                value: 'WEB' },
                            { label: 'Payment Account Type',  value: 'CARD' },
                            { label: 'Card Type',             value: pm.cardType },
                            { label: 'Cardholder Name',       value: `${result.member.firstName} ${result.member.lastName}` },
                            { label: 'Last 4',                value: pm.last4 },
                            { label: 'Token',                 value: pm.panToken ?? '—' },
                            { label: 'Authorization Date',    value: formatDate(ap.createdAt) },
                          ].map(f => (
                            <div key={f.label} className="flex flex-col">
                              <span className="text-xs text-gray-400">{f.label}</span>
                              <span className={`text-xs font-medium text-gray-800 break-all ${f.label === 'Token' ? 'font-mono' : ''}`}>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* ── Current Payment Account ── */}
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-2">Current Payment Account</p>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-6 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 capitalize">{pm.brand}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            { label: 'Status',          value: 'Open' },
                            { label: 'Cardholder Name', value: `${result.member.firstName} ${result.member.lastName}` },
                            { label: 'Last 4',          value: pm.last4 },
                            { label: 'Expiration Date', value: `${pm.expMonth}/${pm.expYear}` },
                            { label: 'Card Type',       value: pm.cardType },
                          ].map(f => (
                            <div key={f.label} className="flex flex-col">
                              <span className="text-xs text-gray-400">{f.label}</span>
                              <span className="text-xs font-medium text-gray-800">{f.value}</span>
                            </div>
                          ))}
                        </div>
                        {pm.panToken && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-0.5">Tokens</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Adyen</span>
                              <span className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">{pm.panToken}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <Card title="Recent Payments">
                {result.billingHistory.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No billing history</p>
                ) : (
                  <div className="space-y-1">
                    {result.billingHistory.map(b => (
                      <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate">{b.description ?? 'Payment'}</p>
                          <p className="text-xs text-gray-400">{formatDate(b.paidAt ?? b.createdAt)}</p>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-900">{formatCurrency(b.amount)}</p>
                          {statusBadge(b.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div className="px-6 py-12 text-center">
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm">Enter a policy number to view full details</p>
          <p className="text-gray-300 text-xs mt-1">e.g. WVH700001000</p>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { accessToken } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 mt-0.5 text-sm">Search by policy number to view full insurance and payment details.</p>
      </div>

      <PolicyLookupPanel accessToken={accessToken!} />
    </div>
  )
}
