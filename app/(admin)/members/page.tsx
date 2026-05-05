'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatDate, getInitials } from '@/lib/utils'

interface Member {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  createdAt: string
  activePolicies: number
  _count: { policies: number; billingHistory: number }
}

interface Pagination {
  page: number
  totalPages: number
  total: number
}

export default function MembersPage() {
  const { accessToken } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchMembers = useCallback((page = 1, q = search) => {
    if (!accessToken) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (q) params.set('search', q)
    fetch(`/api/admin/members?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => {
        setMembers(data.members ?? [])
        setPagination(data.pagination ?? { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [accessToken, search])

  useEffect(() => { fetchMembers(1) }, [accessToken])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    fetchMembers(1, searchInput)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-slate-400 text-sm mt-1">All registered members and their account details.</p>
        </div>
        <span className="bg-slate-700 text-slate-300 text-sm px-3 py-1 rounded-full border border-slate-600">
          {pagination.total.toLocaleString()} total
        </span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); fetchMembers(1, '') }}
            className="text-slate-400 hover:text-white px-3 py-2.5 rounded-lg text-sm transition-colors border border-slate-700"
          >
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No members found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Policies</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Payments</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-600/40 flex items-center justify-center text-blue-300 text-xs font-semibold flex-shrink-0">
                        {getInitials(member.firstName, member.lastName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{member.phone ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{formatDate(member.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${member.activePolicies > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {member.activePolicies}
                    </span>
                    <span className="text-slate-600 text-xs ml-1">/ {member._count.policies} total</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{member._count.billingHistory}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/members/${member.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      View details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{pagination.total} members</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMembers(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="px-3 py-1.5 text-sm border border-slate-700 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400 px-2">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchMembers(pagination.page + 1)}
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
