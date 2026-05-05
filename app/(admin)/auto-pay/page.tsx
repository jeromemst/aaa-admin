'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeColor, getPlanTypeLabel, getStatusColor } from '@/lib/utils'

interface AutoPaySetting {
  id: string
  enabled: boolean
  createdAt: string
  member: { id: string; firstName: string; lastName: string; email: string }
  policy: {
    policyNumber: string
    status: string
    plan: { name: string; type: string; premium: number }
  }
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number }
}

interface Summary { enabled: number; disabled: number }
interface Pagination { page: number; totalPages: number; total: number }

export default function AutoPayPage() {
  const { accessToken } = useAuth()
  const [settings, setSettings] = useState<AutoPaySetting[]>([])
  const [summary, setSummary] = useState<Summary>({ enabled: 0, disabled: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'' | 'true' | 'false'>('')

  const fetchSettings = useCallback((page = 1, enabled = filter) => {
    if (!accessToken) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (enabled !== '') params.set('enabled', enabled)
    fetch(`/api/admin/auto-pay?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => {
        setSettings(data.settings ?? [])
        setSummary(data.summary ?? { enabled: 0, disabled: 0 })
        setPagination(data.pagination ?? { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [accessToken, filter])

  useEffect(() => { fetchSettings(1) }, [accessToken])

  function handleFilter(v: '' | 'true' | 'false') {
    setFilter(v)
    fetchSettings(1, v)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Auto-Pay</h1>
          <p className="text-slate-400 text-sm mt-1">All auto-pay subscriptions across all members.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-800 border border-emerald-600/30 rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{summary.enabled}</p>
            <p className="text-xs text-slate-500 mt-0.5">Enabled</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-slate-400">{summary.disabled}</p>
            <p className="text-xs text-slate-500 mt-0.5">Disabled</p>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-5 flex gap-2">
        {([['', 'All'], ['true', 'Enabled'], ['false', 'Disabled']] as ['' | 'true' | 'false', string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => handleFilter(v)}
            className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${
              filter === v
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
          </div>
        ) : settings.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No auto-pay settings found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy #</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Premium</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Card</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Pay</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {settings.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/members/${s.member.id}`} className="hover:text-blue-400 transition-colors">
                      <p className="text-sm text-white">{s.member.firstName} {s.member.lastName}</p>
                      <p className="text-xs text-slate-500">{s.member.email}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlanTypeColor(s.policy.plan.type)}`}>
                        {getPlanTypeLabel(s.policy.plan.type)}
                      </span>
                      <span className="text-sm text-slate-300 truncate max-w-28">{s.policy.plan.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 font-mono">{s.policy.policyNumber}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(s.policy.status)}`}>
                      {s.policy.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">{formatCurrency(s.policy.plan.premium)}/mo</td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-300 capitalize">{s.paymentMethod.brand} •••• {s.paymentMethod.last4}</p>
                    <p className="text-xs text-slate-600">Exp {s.paymentMethod.expMonth}/{s.paymentMethod.expYear}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                      s.enabled
                        ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                        : 'bg-slate-700 text-slate-500 border-slate-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{pagination.total} records</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSettings(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="px-3 py-1.5 text-sm border border-slate-700 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400 px-2">{pagination.page} / {pagination.totalPages}</span>
            <button
              onClick={() => fetchSettings(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || loading}
              className="px-3 py-1.5 text-sm border border-slate-700 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
