'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeColor, getPlanTypeLabel, getStatusColor, getInitials } from '@/lib/utils'

interface MemberDetail {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  dateOfBirth: string | null
  stripeCustomerId: string | null
  createdAt: string
  policies: {
    id: string
    policyNumber: string
    status: string
    startDate: string
    renewalDate: string
    plan: { name: string; type: string; premium: number; coverageAmount: number }
    autoPaySetting: { enabled: boolean; paymentMethod: { brand: string; last4: string } | null } | null
  }[]
  paymentMethods: {
    id: string
    brand: string
    last4: string
    expMonth: number
    expYear: number
    isDefault: boolean
    createdAt: string
  }[]
  billingHistory: {
    id: string
    amount: number
    status: string
    description: string | null
    paidAt: string | null
    createdAt: string
    policy: { policyNumber: string; plan: { name: string } }
  }[]
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken || !id) return
    fetch(`/api/admin/members/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setMember(data.member))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
    </div>
  )
  if (!member) return (
    <div className="text-center py-20 text-slate-500">Member not found.</div>
  )

  const activePolicies = member.policies.filter(p => p.status === 'ACTIVE')
  const totalPaid = member.billingHistory
    .filter(b => b.status === 'SUCCEEDED')
    .reduce((sum, b) => sum + b.amount, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <Link href="/members" className="text-slate-500 hover:text-slate-300 transition-colors mt-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-600/40 flex items-center justify-center text-blue-300 text-lg font-bold">
            {getInitials(member.firstName, member.lastName)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{member.firstName} {member.lastName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{member.email}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Policies', value: activePolicies.length, color: 'text-emerald-400' },
          { label: 'Total Policies', value: member.policies.length, color: 'text-white' },
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'text-amber-400' },
          { label: 'Saved Cards', value: member.paymentMethods.length, color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Account Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Account Info</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Email', value: member.email },
              { label: 'Phone', value: member.phone ?? '—' },
              { label: 'Date of Birth', value: formatDate(member.dateOfBirth) },
              { label: 'Member Since', value: formatDate(member.createdAt) },
              { label: 'Stripe ID', value: member.stripeCustomerId ?? '—' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-slate-500 text-xs">{f.label}</p>
                <p className="text-slate-200 mt-0.5 font-mono text-xs break-all">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Payment Methods</h2>
          {member.paymentMethods.length === 0 ? (
            <p className="text-slate-600 text-sm">No payment methods on file</p>
          ) : (
            <div className="space-y-3">
              {member.paymentMethods.map(pm => (
                <div key={pm.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div>
                    <p className="text-sm text-white capitalize">{pm.brand} •••• {pm.last4}</p>
                    <p className="text-xs text-slate-500">Expires {pm.expMonth}/{pm.expYear}</p>
                  </div>
                  {pm.isDefault && (
                    <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Pay Summary */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Auto-Pay Status</h2>
          {activePolicies.length === 0 ? (
            <p className="text-slate-600 text-sm">No active policies</p>
          ) : (
            <div className="space-y-3">
              {activePolicies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div>
                    <p className="text-sm text-white">{policy.plan.name}</p>
                    <p className="text-xs text-slate-500">#{policy.policyNumber}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    policy.autoPaySetting?.enabled
                      ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                      : 'bg-slate-700 text-slate-500'
                  }`}>
                    {policy.autoPaySetting?.enabled ? 'Enabled' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Policies */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl mb-6">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Policies</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-900/30">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Premium</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Start</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Renewal</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {member.policies.map(policy => (
              <tr key={policy.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{policy.policyNumber}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlanTypeColor(policy.plan.type)}`}>
                    {getPlanTypeLabel(policy.plan.type)}
                  </span>
                  <span className="ml-2 text-sm text-slate-300">{policy.plan.name}</span>
                </td>
                <td className="px-6 py-4 text-sm text-white font-medium">{formatCurrency(policy.plan.premium)}/mo</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(policy.status)}`}>
                    {policy.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">{formatDate(policy.startDate)}</td>
                <td className="px-6 py-4 text-sm text-slate-400">{formatDate(policy.renewalDate)}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium ${policy.autoPaySetting?.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {policy.autoPaySetting?.enabled ? '✓ On' : '— Off'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Billing History */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Billing History</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-900/30">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Policy</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {member.billingHistory.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-600 text-sm">No billing history</td></tr>
            ) : member.billingHistory.map(b => (
              <tr key={b.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-300">{b.description ?? '—'}</td>
                <td className="px-6 py-4 text-xs text-slate-500 font-mono">{b.policy.policyNumber}</td>
                <td className="px-6 py-4 text-sm text-slate-400">{formatDate(b.paidAt ?? b.createdAt)}</td>
                <td className="px-6 py-4 text-sm font-semibold text-white">{formatCurrency(b.amount)}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(b.status)}`}>
                    {b.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
