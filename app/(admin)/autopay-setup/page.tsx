'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, getInitials, getPlanTypeLabel } from '@/lib/utils'

type CardType = 'CREDIT' | 'DEBIT' | 'PREPAID'

interface MemberResult {
  id: string
  firstName: string
  lastName: string
  email: string
  state: string | null
  eligibilityStatus: number
}

interface Policy {
  id: string
  policyNumber: string
  status: string
  plan: { id: string; name: string; type: string; premium: number; productCode: string | null; stateRestriction: string | null }
  autoPaySetting: { enabled: boolean } | null
}

interface PaymentMethod {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  cardType: CardType
  isDefault: boolean
  panToken: string | null
}

interface MemberDetail {
  id: string
  firstName: string
  lastName: string
  email: string
  state: string | null
  eligibilityStatus: number
  policies: Policy[]
  paymentMethods: PaymentMethod[]
}

interface ValidationResult {
  allowed: boolean
  rejectionCode?: string
  rejectionMessage?: string
  details?: Record<string, unknown>
  message?: string
}

const CARD_TYPE_COLORS: Record<CardType, string> = {
  CREDIT:  'bg-purple-50 text-purple-700 border-purple-200',
  DEBIT:   'bg-blue-50 text-blue-700 border-blue-200',
  PREPAID: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function AutoPaySetupPage() {
  const { accessToken } = useAuth()
  const headers = { Authorization: `Bearer ${accessToken}` }

  const [search, setSearch]               = useState('')
  const [searchResults, setSearchResults] = useState<MemberResult[]>([])
  const [searching, setSearching]         = useState(false)

  const [member, setMember]               = useState<MemberDetail | null>(null)
  const [loadingMember, setLoadingMember] = useState(false)

  const [selectedPolicy, setSelectedPolicy] = useState<string>('')
  const [selectedPm, setSelectedPm]         = useState<string>('')
  const [submitting, setSubmitting]         = useState(false)
  const [result, setResult]                 = useState<ValidationResult | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    setSearchResults([])
    const r = await fetch(`/api/admin/autopay-setup?search=${encodeURIComponent(search)}`, { headers })
    const data = await r.json()
    setSearchResults(data.members ?? [])
    setSearching(false)
  }

  const loadMember = useCallback(async (id: string) => {
    setLoadingMember(true)
    setResult(null)
    setSelectedPolicy('')
    setSelectedPm('')
    const r = await fetch(`/api/admin/autopay-setup?memberId=${id}`, { headers })
    const data = await r.json()
    setMember(data.member ?? null)
    setSearchResults([])
    setSearch('')
    setLoadingMember(false)
  }, [accessToken])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPolicy || !selectedPm) return
    setSubmitting(true)
    setResult(null)
    const r = await fetch('/api/admin/autopay-setup', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId: selectedPolicy, paymentMethodId: selectedPm }),
    })
    const data = await r.json()
    setResult(data)
    setSubmitting(false)
    if (data.allowed && member) loadMember(member.id)
  }

  const currentPolicy = member?.policies.find(p => p.id === selectedPolicy) ?? null
  const currentPm     = member?.paymentMethods.find(p => p.id === selectedPm) ?? null

  const showCaWarning = currentPolicy?.plan.productCode === 'CAC'
    && (currentPolicy?.plan.stateRestriction === 'CA' || member?.state === 'CA')
    && currentPm?.cardType === 'CREDIT'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">AutoPay Setup</h1>
        <p className="text-gray-400 text-sm mt-0.5">Search for a member, select a policy and payment method, then validate eligibility.</p>
      </div>

      {/* Step 1 — Find Member */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Step 1 — Find Member</p>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={searching || !search.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            {searching ? 'Searching…' : 'Search'}
          </button>
          {member && (
            <button type="button" onClick={() => { setMember(null); setResult(null) }}
              className="px-3 border border-gray-200 text-gray-500 hover:text-gray-900 rounded-lg text-sm transition-colors">
              Clear
            </button>
          )}
        </form>

        {/* Quick-load buttons */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-300">Quick load:</span>
          {[
            { label: 'TC-1 Active (TX)',  email: 'tc1.active@demo.insure' },
            { label: 'TC-2 Blocked (FL)', email: 'tc2.blocked@demo.insure' },
            { label: 'TC-4 CA member',    email: 'tc4.ca@demo.insure' },
          ].map(q => (
            <button key={q.email}
              onClick={async () => {
                setSearching(true)
                const r = await fetch(`/api/admin/autopay-setup?search=${encodeURIComponent(q.email)}`, { headers })
                const data = await r.json()
                if (data.members?.[0]) loadMember(data.members[0].id)
                else setSearching(false)
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
              {q.label}
            </button>
          ))}
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {searchResults.map(m => (
              <button key={m.id} onClick={() => loadMember(m.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                  {getInitials(m.firstName, m.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.firstName} {m.lastName}</p>
                  <p className="text-xs text-gray-400">{m.email} · {m.state ?? '—'}</p>
                </div>
                {m.eligibilityStatus === 4 && (
                  <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Blocked</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected member */}
        {member && !loadingMember && (
          <div className="mt-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
              {getInitials(member.firstName, member.lastName)}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{member.firstName} {member.lastName}</p>
              <p className="text-xs text-gray-500">
                {member.email} · State: <strong>{member.state ?? 'Unknown'}</strong> · Eligibility:{' '}
                <strong className={member.eligibilityStatus === 4 ? 'text-red-600' : 'text-emerald-600'}>{member.eligibilityStatus}</strong>
              </p>
            </div>
            <Link href={`/members/${member.id}`} className="ml-auto text-xs text-blue-600 hover:underline">View member →</Link>
          </div>
        )}
      </div>

      {loadingMember && (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      )}

      {member && !loadingMember && (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Step 2: Select Policy */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Step 2 — Select Policy</p>
              {member.policies.length === 0 ? (
                <p className="text-gray-400 text-sm">No active policies found.</p>
              ) : (
                <div className="space-y-2">
                  {member.policies.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPolicy === p.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="policy" value={p.id} checked={selectedPolicy === p.id}
                        onChange={() => { setSelectedPolicy(p.id); setResult(null) }} className="accent-blue-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">{p.plan.name}</p>
                          {p.plan.productCode && (
                            <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded font-mono">{p.plan.productCode}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.policyNumber} · {getPlanTypeLabel(p.plan.type)} · {formatCurrency(p.plan.premium)}/mo</p>
                        {p.plan.stateRestriction && (
                          <p className="text-xs text-amber-600 mt-0.5">⚠ Debit-only in {p.plan.stateRestriction}</p>
                        )}
                        {p.autoPaySetting?.enabled && (
                          <p className="text-xs text-emerald-600 mt-0.5">✓ AutoPay already active</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Select Payment Method */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Step 3 — Select Payment Method</p>
              {member.paymentMethods.length === 0 ? (
                <p className="text-gray-400 text-sm">No payment methods on file.</p>
              ) : (
                <div className="space-y-2">
                  {member.paymentMethods.map(pm => (
                    <label key={pm.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPm === pm.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="pm" value={pm.id} checked={selectedPm === pm.id}
                        onChange={() => { setSelectedPm(pm.id); setResult(null) }} className="accent-blue-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-800 capitalize font-medium">{pm.brand} •••• {pm.last4}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${CARD_TYPE_COLORS[pm.cardType]}`}>{pm.cardType}</span>
                          {pm.isDefault && <span className="text-xs text-gray-400">Default</span>}
                        </div>
                        <p className="text-xs text-gray-400">Exp {pm.expMonth}/{pm.expYear}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pre-flight CA warning */}
          {showCaWarning && (
            <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-700">Credit card will be rejected</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This is a <strong>CAC</strong> (California) product and the selected card is a <strong>CREDIT</strong> card.
                  Per CA regulation, only debit cards are accepted. Switch to the debit card to proceed.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!selectedPolicy || !selectedPm || submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {submitting
                ? <><span className="animate-spin h-3.5 w-3.5 rounded-full border-b-2 border-white" />Validating…</>
                : 'Validate & Set Up AutoPay'}
            </button>
            <p className="text-xs text-gray-400">All rules will be checked before setup is completed.</p>
          </div>
        </form>
      )}

      {/* Result Panel */}
      {result && (
        <div className={`mt-5 rounded-xl border overflow-hidden ${result.allowed ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className={`px-6 py-4 flex items-center gap-3 ${result.allowed ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${result.allowed ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <svg className={`w-4 h-4 ${result.allowed ? 'text-emerald-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {result.allowed
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />}
              </svg>
            </div>
            <div>
              <p className={`font-semibold text-sm ${result.allowed ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.allowed ? 'AutoPay Setup Successful' : 'Setup Rejected'}
              </p>
              <p className={`text-xs mt-0.5 ${result.allowed ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.allowed ? result.message : result.rejectionMessage}
              </p>
            </div>
          </div>
          {!result.allowed && result.details && (
            <div className="px-6 py-4 bg-white border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Rejection Details</p>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(result.details).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-semibold text-gray-800">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
