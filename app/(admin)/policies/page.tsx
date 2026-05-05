'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeColor, getPlanTypeLabel, getStatusColor } from '@/lib/utils'

interface Policy {
  id: string
  policyNumber: string
  status: string
  startDate: string
  renewalDate: string
  member: { id: string; firstName: string; lastName: string; email: string }
  plan: { name: string; type: string; premium: number }
  autoPaySetting: { enabled: boolean } | null
}

interface Pagination { page: number; totalPages: number; total: number }

const STATUSES = ['', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING']
const TYPES = ['', 'HEALTH', 'AUTO', 'LIFE', 'HOME']

export default function PoliciesPage() {
  const { accessToken } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', type: '' })

  const fetchPolicies = useCallback((page = 1, f = filters) => {
    if (!accessToken) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (f.search) params.set('search', f.search)
    if (f.status) params.set('status', f.status)
    if (f.type) params.set('type', f.type)
    fetch(`/api/admin/policies?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => {
        setPolicies(data.policies ?? [])
        setPagination(data.pagination ?? { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [accessToken, filters])

  useEffect(() => { fetchPolicies(1) }, [accessToken])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const newF = { ...filters, search: searchInput }
    setFilters(newF)
    fetchPolicies(1, newF)
  }

  function handleFilter(key: 'status' | 'type', value: string) {
    const newF = { ...filters, [key]: value }
    setFilters(newF)
    fetchPolicies(1, newF)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Policies</h1>
          <p className="text-slate-400 text-sm mt-1">All insurance policies across all members.</p>
        </div>
        <span className="bg-slate-700 text-slate-300 text-sm px-3 py-1 rounded-full border border-slate-600">
          {pagination.total.toLocaleString()} total
        </span>
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search policy #, member name or email…"
            className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Search
          </button>
        </form>

        <select
          value={filters.status}
          onChange={e => handleFilter('status', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>

        <select
          value={filters.type}
          onChange={e => handleFilter('type', e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TYPES.map(t => <option key={t} value={t}>{t ? getPlanTypeLabel(t) : 'All Types'}</option>)}
        </select>

        {(filters.search || filters.status || filters.type) && (
          <button
            onClick={() => {
              const f = { search: '', status: '', type: '' }
              setFilters(f); setSearchInput('')
              fetchPolicies(1, f)
            }}
            className="text-slate-400 hover:text-white text-sm px-3 py-2 border border-slate-700 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No policies found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy #</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Premium</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Renewal</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {policies.map(policy => (
                <tr key={policy.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 text-xs text-slate-400 font-mono">{policy.policyNumber}</td>
                  <td className="px-5 py-4">
                    <Link href={`/members/${policy.member.id}`} className="hover:text-blue-400 transition-colors">
                      <p className="text-sm text-white">{policy.member.firstName} {policy.member.lastName}</p>
                      <p className="text-xs text-slate-500">{policy.member.email}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlanTypeColor(policy.plan.type)}`}>
                        {getPlanTypeLabel(policy.plan.type)}
                      </span>
                      <span className="text-sm text-slate-300">{policy.plan.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">{formatCurrency(policy.plan.premium)}/mo</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(policy.status)}`}>
                      {policy.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400">{formatDate(policy.renewalDate)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium ${policy.autoPaySetting?.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {policy.autoPaySetting?.enabled ? '✓ On' : '— Off'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{pagination.total} policies</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPolicies(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="px-3 py-1.5 text-sm border border-slate-700 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400 px-2">{pagination.page} / {pagination.totalPages}</span>
            <button
              onClick={() => fetchPolicies(pagination.page + 1)}
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
