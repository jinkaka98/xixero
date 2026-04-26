import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../lib/adminApi'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const data = await adminApi.getDashboard()
      setStats(data)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(), 10000)
    return () => clearInterval(interval)
  }, [load])

  if (error) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div className="relative bg-red-950/30 border-2 border-red-500/50 rounded-xl p-8 text-red-300 overflow-hidden">
          <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>
          <div className="relative flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-950/50 border-2 border-red-500/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-bold font-mono text-lg">CONNECTION ERROR</p>
              <p className="text-sm opacity-80 mt-1">{error}</p>
            </div>
            <button
              onClick={() => load(true)}
              className="px-6 py-2 bg-red-600/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-600/30 transition-colors font-mono text-sm"
            >
              RETRY CONNECTION
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-orange-500/20 rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-gray-800 rounded mb-4"></div>
              <div className="h-8 w-16 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3 text-orange-400 font-mono py-8">
          <div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></div>
          <span>INITIALIZING DASHBOARD...</span>
        </div>
      </div>
    )
  }

  const activePercent = stats.total_licenses > 0 ? Math.round((stats.active_licenses / stats.total_licenses) * 100) : 0
  const revokedPercent = stats.total_licenses > 0 ? Math.round((stats.revoked / stats.total_licenses) * 100) : 0
  const expiredCount = stats.total_licenses - stats.active_licenses - stats.revoked
  const expiredPercent = stats.total_licenses > 0 ? Math.round((expiredCount / stats.total_licenses) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-start justify-between">
        <DashboardHeader />
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-600 font-mono">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors border border-transparent hover:border-orange-500/20"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Licenses"
          value={stats.total_licenses}
          color="orange"
          trend={stats.total_licenses > 0 ? 'up' : 'neutral'}
          icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" /></svg>}
        />
        <StatCard
          label="Active"
          value={stats.active_licenses}
          color="green"
          subtitle={`${activePercent}% of total`}
          icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          label="Revoked"
          value={stats.revoked}
          color="red"
          subtitle={`${revokedPercent}% of total`}
          icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          label="Requests Today"
          value={stats.requests_today}
          color="purple"
          trend="up"
          icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* License Distribution - 2 cols */}
        <div className="lg:col-span-2 relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <SectionHeader title="LICENSE DISTRIBUTION" color="orange" />

            {stats.total_licenses > 0 ? (
              <div className="space-y-5 mt-6">
                {/* Visual Bar Chart */}
                <div className="flex h-6 rounded-lg overflow-hidden border border-orange-500/20">
                  {activePercent > 0 && (
                    <div
                      className="bg-gradient-to-r from-green-600 to-green-500 transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${activePercent}%` }}
                    >
                      {activePercent > 15 && <span className="text-[10px] font-mono text-white font-bold">{activePercent}%</span>}
                    </div>
                  )}
                  {expiredPercent > 0 && (
                    <div
                      className="bg-gradient-to-r from-yellow-600 to-yellow-500 transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${expiredPercent}%` }}
                    >
                      {expiredPercent > 15 && <span className="text-[10px] font-mono text-white font-bold">{expiredPercent}%</span>}
                    </div>
                  )}
                  {revokedPercent > 0 && (
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-500 transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${revokedPercent}%` }}
                    >
                      {revokedPercent > 15 && <span className="text-[10px] font-mono text-white font-bold">{revokedPercent}%</span>}
                    </div>
                  )}
                </div>

                {/* Legend + Details */}
                <div className="grid grid-cols-3 gap-4">
                  <DistributionItem label="Active" value={stats.active_licenses} percent={activePercent} color="green" />
                  <DistributionItem label="Expired" value={expiredCount} percent={expiredPercent} color="yellow" />
                  <DistributionItem label="Revoked" value={stats.revoked} percent={revokedPercent} color="red" />
                </div>

                {/* Progress Bars */}
                <div className="space-y-3 pt-2">
                  <ProgressBar label="Active" value={stats.active_licenses} total={stats.total_licenses} color="green" />
                  <ProgressBar label="Expired" value={expiredCount} total={stats.total_licenses} color="yellow" />
                  <ProgressBar label="Revoked" value={stats.revoked} total={stats.total_licenses} color="red" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-mono text-sm">NO LICENSES YET</p>
                <button
                  onClick={() => navigate('/admin/licenses')}
                  className="mt-3 px-4 py-2 bg-orange-600/20 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-600/30 transition-colors font-mono text-xs"
                >
                  CREATE FIRST LICENSE
                </button>
              </div>
            )}
          </div>
        </div>

        {/* System Status - 1 col */}
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <SectionHeader title="SYSTEM" color="red" />

            <div className="space-y-4 mt-6">
              <SystemItem label="API Server" status="online" />
              <SystemItem label="Admin Panel" status="online" />
              <SystemItem label="License Engine" status={stats.total_licenses > 0 ? 'online' : 'idle'} />
              <SystemItem label="Auto-Refresh" status="online" detail="10s interval" />

              <div className="pt-3 border-t border-red-500/20">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-500 font-mono">UPTIME</span>
                  <span className="text-green-400 font-mono">99.9%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: '99.9%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-6 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <SectionHeader title="QUICK ACTIONS" color="orange" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <QuickAction
              label="Manage Licenses"
              description="View, create, and revoke licenses"
              onClick={() => navigate('/admin/licenses')}
              icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
              badge={`${stats.total_licenses} total`}
            />
            <QuickAction
              label="Generate License"
              description="Create a new license key"
              onClick={() => navigate('/admin/licenses')}
              icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>}
              highlight
            />
            <QuickAction
              label="Refresh Data"
              description="Force refresh all dashboard data"
              onClick={() => load(true)}
              icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>}
              loading={refreshing}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-Components ─── */

function DashboardHeader() {
  return (
    <div>
      <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 tracking-wider mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
        DASHBOARD
      </h1>
      <div className="h-1 w-32 bg-gradient-to-r from-orange-400 to-transparent rounded-full"></div>
    </div>
  )
}

function SectionHeader({ title, color }) {
  const gradients = {
    orange: 'from-orange-400 to-red-400',
    red: 'from-red-400 to-pink-400',
    green: 'from-green-400 to-emerald-400',
    purple: 'from-purple-400 to-pink-400',
  }
  return (
    <div className="flex items-center gap-3">
      <div className={`w-1 h-8 bg-gradient-to-b ${gradients[color]} rounded-full`}></div>
      <h2 className="text-lg font-bold text-white font-mono tracking-wider">{title}</h2>
    </div>
  )
}

function StatCard({ label, value, color, icon, subtitle, trend }) {
  const themes = {
    orange: { border: 'border-orange-500/30', bg: 'from-orange-950/50 to-orange-900/30', text: 'text-orange-400', glow: 'bg-orange-500/20', pulse: 'bg-orange-400' },
    green:  { border: 'border-green-500/30',  bg: 'from-green-950/50 to-green-900/30',  text: 'text-green-400',  glow: 'bg-green-500/20',  pulse: 'bg-green-400' },
    red:    { border: 'border-red-500/30',    bg: 'from-red-950/50 to-red-900/30',    text: 'text-red-400',    glow: 'bg-red-500/20',    pulse: 'bg-red-400' },
    purple: { border: 'border-purple-500/30', bg: 'from-purple-950/50 to-purple-900/30', text: 'text-purple-400', glow: 'bg-purple-500/20', pulse: 'bg-purple-400' },
  }
  const t = themes[color]

  return (
    <div className={`relative bg-gradient-to-br ${t.bg} backdrop-blur-xl border ${t.border} rounded-xl p-5 overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 ${t.glow} rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs uppercase tracking-wider font-mono ${t.text} opacity-70`}>{label}</p>
          <div className={t.text}>{icon}</div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${t.pulse} rounded-full animate-pulse`}></div>
            <p className={`text-3xl font-bold ${t.text} font-mono`}>{value}</p>
          </div>
          {trend === 'up' && (
            <svg className="w-4 h-4 text-green-400 mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 font-mono mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function DistributionItem({ label, value, percent, color }) {
  const colors = {
    green: { dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    yellow: { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    red: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }
  const c = colors[color]
  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-3 text-center`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`w-2 h-2 ${c.dot} rounded-full`}></div>
        <span className="text-xs text-gray-400 font-mono">{label}</span>
      </div>
      <p className={`text-xl font-bold ${c.text} font-mono`}>{value}</p>
      <p className="text-[10px] text-gray-600 font-mono">{percent}%</p>
    </div>
  )
}

function ProgressBar({ label, value, total, color }) {
  const percent = total > 0 ? (value / total) * 100 : 0
  const colors = {
    green: 'from-green-600 to-green-400',
    yellow: 'from-yellow-600 to-yellow-400',
    red: 'from-red-600 to-red-400',
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-mono">{label}</span>
        <span className="text-gray-400 font-mono font-bold">{value} / {total}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-700`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  )
}

function SystemItem({ label, status, detail }) {
  const statusConfig = {
    online: { dot: 'bg-green-400 animate-pulse', text: 'text-green-400', label: 'ONLINE' },
    offline: { dot: 'bg-red-400', text: 'text-red-400', label: 'OFFLINE' },
    idle: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'IDLE' },
  }
  const s = statusConfig[status]
  return (
    <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-red-500/15 hover:border-red-500/30 transition-colors">
      <span className="text-gray-400 text-sm font-mono">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-[10px] text-gray-600 font-mono">{detail}</span>}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></div>
          <span className={`text-xs font-mono font-bold ${s.text}`}>{s.label}</span>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ label, description, onClick, icon, badge, highlight, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`relative p-5 rounded-xl border text-left transition-all duration-300 group hover:scale-[1.02] w-full ${
        highlight
          ? 'bg-gradient-to-br from-orange-600/20 to-red-600/20 border-orange-500/40 hover:border-orange-500/60'
          : 'bg-black/30 border-orange-500/20 hover:border-orange-500/40'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
          highlight
            ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-400/40 text-orange-300'
            : 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-400/30 text-orange-400'
        }`}>
          {loading ? (
            <div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></div>
          ) : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-mono font-bold text-sm">{label}</h3>
            {badge && (
              <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-[10px] text-orange-400 font-mono">{badge}</span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1">{description}</p>
        </div>
        <svg className="w-5 h-5 text-orange-400/30 group-hover:text-orange-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  )
}
