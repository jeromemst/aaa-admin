'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils'

const CARD_TYPES = ['CREDIT', 'DEBIT', 'PREPAID'] as const
type CardType = typeof CARD_TYPES[number]

interface ActivityLog {
  id: string
  action: string
  fromValue: string | null
  toValue: string | null
  performedBy: string
  note: string | null
  createdAt: string
}

interface PaymentMethod {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  cardType: CardType
  panToken: string | null
  isDefault: boolean
  createdAt: string
  member: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    state: string | null
    eligibilityStatus: number
  }
  activityLogs: ActivityLog[]
  autoPaySettings: {
    enabled: boolean
    policy: { policyNumber: string; status: string; plan: { name: string; type: string } }
  }[]
}

const ACTION_LABELS: Record<string, string> = {
  CARD_ADDED:        'Card Added',
  CARD_TYPE_CHANGED: 'Type Changed',
  CARD_REMOVED:      'Card Removed',
}

const CARD_TYPE_COLORS: Record<CardType, string> = {
  CREDIT:  'bg-purple-50 text-purple-700 border-purple-200',
  DEBIT:   'bg-blue-50 text-blue-700 border-blue-200',
  PREPAID: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function PanMaintenancePage() {
  const { accessToken } = useAuth()

  const [tokenInput, setTokenInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [pm, setPm] = useState<PaymentMethod | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [newType, setNewType] = useState<CardType>('DEBIT')
  const [note, setNote] = useState('')
  const [changing, setChanging] = useState(false)
  const [changeMsg, setChangeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const headers = { Authorization: `Bearer ${accessToken}` }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setSearching(true)
    setLookupError('')
    setPm(null)
    setChangeMsg(null)
    try {
      const r = await fetch(`/api/admin/pan-lookup?token=${encodeURIComponent(tokenInput.trim())}`, { headers })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setPm(data.paymentMethod)
      setNewType(data.paymentMethod.cardType === 'CREDIT' ? 'DEBIT' : 'CREDIT')
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleChangeType() {
    if (!pm) return
    setChanging(true)
    setChangeMsg(null)
    try {
      const r = await fetch(`/api/admin/pan-lookup/${pm.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: newType, note: note || undefined }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setChangeMsg({ ok: true, text: `Card type successfully changed to ${newType}.` })
      setShowConfirm(false)
      setNote('')
      const r2 = await fetch(`/api/admin/pan-lookup?token=${encodeURIComponent(tokenInput.trim())}`, { headers })
      const d2 = await r2.json()
      if (r2.ok) setPm(d2.paymentMethod)
    } catch (err: unknown) {
      setChangeMsg({ ok: false, text: err instanceof Error ? err.message : 'Change failed' })
    } finally {
      setChanging(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">PAN Maintenance</h1>
        <p className="text-gray-400 text-sm mt-0.5">Look up a card by PAN token and update its card type. All changes are logged.</p>
      </div>

      {/* Token Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="font-semibold text-gray-800 text-sm">Token Lookup</h2>
        </div>
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value.toUpperCase())}
              placeholder="e.g. PD8VHPWF8BPTDD75"
              className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !tokenInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {searching
              ? <><span className="animate-spin h-3.5 w-3.5 rounded-full border-b-2 border-white" />Searching…</>
              : 'Look up'}
          </button>
          {pm && (
            <button type="button" onClick={() => { setPm(null); setTokenInput(''); setChangeMsg(null); setLookupError(''); inputRef.current?.focus() }}
              className="px-3 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg text-sm transition-colors">
              Clear
            </button>
          )}
        </form>
        {lookupError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {lookupError}
          </div>
        )}
      </div>

      {pm && (
        <>
          {changeMsg && (
            <div className={`mb-5 px-4 py-3 rounded-lg border text-sm flex items-center gap-2 ${changeMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {changeMsg.ok
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
              </svg>
              {changeMsg.text}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Card Details */}
            <div className="col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Card Details</h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${CARD_TYPE_COLORS[pm.cardType]}`}>
                  {pm.cardType}
                </span>
              </div>
              <div className="p-6">
                {/* Card header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 capitalize">{pm.brand} •••• {pm.last4}</p>
                    <p className="text-sm text-gray-400">Expires {pm.expMonth}/{pm.expYear}</p>
                  </div>
                </div>

                {/* Info tiles */}
                <div className="grid grid-cols-3 gap-3 text-sm mb-6">
                  {[
                    { label: 'PAN Token',  value: pm.panToken ?? '—', mono: true },
                    { label: 'Card ID',    value: pm.id,              mono: true },
                    { label: 'Card Type',  value: pm.cardType,        mono: false },
                    { label: 'Default',    value: pm.isDefault ? 'Yes' : 'No', mono: false },
                    { label: 'Added',      value: formatDate(pm.createdAt), mono: false },
                    { label: 'AutoPay policies', value: pm.autoPaySettings.length.toString(), mono: false },
                  ].map(f => (
                    <div key={f.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                      <p className={`text-gray-800 font-medium truncate ${f.mono ? 'font-mono text-xs' : 'text-sm'}`}>{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Cardholder */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cardholder</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
                      {getInitials(pm.member.firstName, pm.member.lastName)}
                    </div>
                    <div>
                      <Link href={`/members/${pm.member.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {pm.member.firstName} {pm.member.lastName}
                      </Link>
                      <p className="text-xs text-gray-400">{pm.member.email} · {pm.member.state ?? '—'}</p>
                    </div>
                    {pm.member.eligibilityStatus === 4 && (
                      <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full font-medium">
                        Blocked (Status 4)
                      </span>
                    )}
                  </div>
                </div>

                {/* AutoPay policies */}
                {pm.autoPaySettings.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AutoPay Policies</p>
                    <div className="space-y-2">
                      {pm.autoPaySettings.map((ap, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                          <span className="text-gray-600 font-mono text-xs">{ap.policy.policyNumber}</span>
                          <span className="text-gray-500 text-xs">{ap.policy.plan.name}</span>
                          <span className={`text-xs font-semibold ${ap.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {ap.enabled ? '✓ Active' : '— Off'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Change Card Type */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Change Card Type</h2>
                <p className="text-xs text-gray-400 mt-0.5">Current: <span className="font-semibold text-gray-700">{pm.cardType}</span></p>
              </div>
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-3">Select new card type</p>
                <div className="space-y-2 mb-4">
                  {CARD_TYPES.filter(t => t !== pm.cardType).map(t => (
                    <label key={t} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      newType === t ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="cardType" value={t} checked={newType === t} onChange={() => setNewType(t)} className="accent-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t}</p>
                        <p className="text-xs text-gray-400">
                          {t === 'CREDIT' ? 'Revolving credit line' : t === 'DEBIT' ? 'Linked bank account' : 'Prepaid balance'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1.5">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="Reason for change…"
                    className="w-full bg-white border border-gray-200 text-gray-800 placeholder-gray-400 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {!showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Change to {newType}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Confirm: change card type from <strong>{pm.cardType}</strong> → <strong>{newType}</strong>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleChangeType}
                        disabled={changing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {changing ? 'Saving…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Activity History</h2>
              <span className="text-xs text-gray-400">{pm.activityLogs.length} events</span>
            </div>
            {pm.activityLogs.length === 0 ? (
              <p className="text-center py-10 text-gray-300 text-sm">No activity recorded yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">From</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">To</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Performed By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Note</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pm.activityLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                          log.action === 'CARD_TYPE_CHANGED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          log.action === 'CARD_ADDED'        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                               'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-400">{log.fromValue ?? '—'}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-800 font-medium">{log.toValue ?? '—'}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{log.performedBy}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-400 italic">{log.note ?? '—'}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-400">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!pm && !lookupError && (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-400 text-sm">Enter a PAN token above to look up a card</p>
          <p className="text-gray-300 text-xs mt-1">Try: PD8VHPWF8BPTDD75</p>
        </div>
      )}
    </div>
  )
}
