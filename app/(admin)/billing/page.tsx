'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeLabel, getStatusColor } from '@/lib/utils'

interface BillingRecord {
  id: string
  amount: number
  status: string
  description: string | null
  paidAt: string | null
  createdAt: string
  member: { id: string; firstName: string; lastName: string; email: string }
  policy: { policyNumber: string; plan: { name: string; type: string } }
}

interface Pagination { page: number; totalPages: number; total: number }

const STATUSES = ['', 'SUCCEEDED', 'FAILED', 'PENDING', 'REFUNDED']

export default function BillingPage() {
  const { accessToken } = useAuth()
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [totalSucceeded, setTotalSucceeded] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '' })

  const fetchBilling = useCallback((page = 1, f = filters) => {
    if (!accessToken) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (f.search) params.set('search', f.search)
    if (f.status) params.set('status', f.status)
    fetch(`/api/admin/billing?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => {
        setRecords(data.records ?? [])
        setTotalSucceeded(data.totalSucceeded ?? 0)
        setPagination(data.pagination ?? { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [accessToken, filters])

  useEffect(() => { fetchBilling(1) }, [accessToken])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const newF = { ...filters, search: searchInput }
    setFilters(newF)
    fetchBilling(1, newF)
  }

  function handleStatusFilter(status: string) {
    const newF = { ...filters, status }
    setFilters(newF)
    fetchBilling(1, newF)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment History</h1>
          <p className="text-slate-400 text-sm mt-1">All billing transactions across all members.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Collected (filtered)</p>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(totalSucceeded)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search member name, email, or policy #…"
            className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Search
          </button>
        </form>

        <select
          value={filters.status}
          onChange={e => handleStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>

        {(filters.search || filters.status) && (
          <button
            onClick={() => {
              const f = { search: '', status: '' }
              setFilters(f); setSearchInput('')
              fetchBilling(1, f)
            }}
            className="text-slate-400 hover:text-white text-sm px-3 py-2 border border-slate-700 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Status Pill Filters */}
      <div className="mb-5 flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              filters.status === s
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No billing records found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy #</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/members/${record.member.id}`} className="hover:text-blue-400 transition-colors">
                      <p className="text-sm text-white">{record.member.firstName} {record.member.lastName}</p>
                      <p className="text-xs text-slate-500">{record.member.email}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-300">{getPlanTypeLabel(record.policy.plan.type)}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 font-mono">{record.policy.policyNumber}</td>
                  <td className="px-5 py-4 text-sm text-slate-400">{record.description ?? '—'}</td>
                  <td className="px-5 py-4 text-sm text-slate-400">{formatDate(record.paidAt ?? record.createdAt)}</td>
                  <td className="px-5 py-4 text-right text-sm font-semibold text-white">{formatCurrency(record.amount)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(record.status)}`}>
                      {record.status.toLowerCase()}
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
          <p className="text-sm text-slate-500">{pagination.total} records</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchBilling(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="px-3 py-1.5 text-sm border border-slate-700 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400 px-2">{pagination.page} / {pagination.totalPages}</span>
            <button
              onClick={() => fetchBilling(pagination.page + 1)}
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
