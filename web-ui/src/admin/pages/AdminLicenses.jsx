import { useState, useEffect, useMemo } from 'react'
import { adminApi } from '../lib/adminApi'

const ITEMS_PER_PAGE = 8

export default function AdminLicenses() {
  const [licenses, setLicenses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedKey, setCopiedKey] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getLicenses()
      setLicenses(data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const getStatus = (lic) => {
    if (lic.revoked) return 'revoked'
    if (new Date(lic.expires_at) < new Date()) return 'expired'
    return 'active'
  }

  const filtered = useMemo(() => {
    let result = licenses
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.key.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter(l => getStatus(l) === filterStatus)
    }
    return result
  }, [licenses, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  useEffect(() => { setCurrentPage(1) }, [search, filterStatus])

  const handleCopy = async (key) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* clipboard not available */ }
  }

  const handleRevoke = async (idOrKey) => {
    setShowConfirm(null)
    setRevoking(idOrKey)
    try {
      // Find the license to get Firestore document ID
      const lic = licenses.find(l => l.key === idOrKey || l.id === idOrKey)
      if (lic) {
        await adminApi.revokeLicense(lic.id)
      }
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRevoking(null)
    }
  }

  const statusCounts = useMemo(() => {
    const counts = { all: licenses.length, active: 0, expired: 0, revoked: 0 }
    licenses.forEach(l => { counts[getStatus(l)]++ })
    return counts
  }, [licenses])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 tracking-wider mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
            LICENSES
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-orange-400 to-transparent rounded-full"></div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="group flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_30px_rgba(251,146,60,0.5)] font-mono text-sm uppercase tracking-wider"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Generate
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="relative bg-red-950/30 border-2 border-red-500/50 rounded-xl p-4 text-red-300 overflow-hidden">
          <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-mono text-sm">{error}</span>
            </div>
            <button onClick={() => { setError(null); load() }} className="text-xs text-red-400 hover:text-red-300 font-mono border border-red-500/30 px-3 py-1 rounded hover:bg-red-950/50 transition-colors">
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400/50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or key..."
              className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-orange-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 focus:shadow-[0_0_15px_rgba(251,146,60,0.2)] transition-all font-mono text-sm"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-black/30 rounded-lg p-1 border border-orange-500/20">
            {['all', 'active', 'expired', 'revoked'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                  filterStatus === status
                    ? 'bg-gradient-to-r from-orange-600/40 to-red-600/40 text-orange-300 border border-orange-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {status} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-12 overflow-hidden">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></div>
            <span className="text-orange-400 font-mono text-sm">LOADING LICENSES...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl p-12 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <svg className="w-48 h-48 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <p className="text-gray-400 font-mono">
              {search || filterStatus !== 'all' ? 'NO MATCHING LICENSES FOUND' : 'NO LICENSES YET'}
            </p>
            {!search && filterStatus === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 px-4 py-2 bg-orange-600/20 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-600/30 transition-colors font-mono text-sm"
              >
                + GENERATE FIRST LICENSE
              </button>
            )}
            {(search || filterStatus !== 'all') && (
              <button
                onClick={() => { setSearch(''); setFilterStatus('all') }}
                className="mt-2 px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors font-mono text-sm"
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-500/20">
                  <th className="px-5 py-4 text-left text-xs text-orange-400/70 uppercase tracking-wider font-mono">Key</th>
                  <th className="px-5 py-4 text-left text-xs text-orange-400/70 uppercase tracking-wider font-mono">Name</th>
                  <th className="px-5 py-4 text-left text-xs text-orange-400/70 uppercase tracking-wider font-mono">Expires</th>
                  <th className="px-5 py-4 text-left text-xs text-orange-400/70 uppercase tracking-wider font-mono">Status</th>
                  <th className="px-5 py-4 text-left text-xs text-orange-400/70 uppercase tracking-wider font-mono">Last Validated</th>
                  <th className="px-5 py-4 text-right text-xs text-orange-400/70 uppercase tracking-wider font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((lic, i) => {
                  const status = getStatus(lic)
                  return (
                    <tr
                      key={lic.key}
                      className="border-b border-orange-500/10 hover:bg-orange-500/5 transition-colors"
                      style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.05}s both` }}
                    >
                      {/* Key */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-300 max-w-[140px] truncate">{lic.key}</span>
                          <button
                            onClick={() => handleCopy(lic.key)}
                            className="flex-shrink-0 p-1 rounded hover:bg-orange-500/20 transition-colors group"
                            title="Copy key"
                          >
                            {copiedKey === lic.key ? (
                              <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-5 py-4">
                        <span className="text-white font-medium">{lic.name}</span>
                      </td>

                      {/* Expires */}
                      <td className="px-5 py-4">
                        <span className="text-gray-400 font-mono text-xs">{new Date(lic.expires_at).toLocaleDateString()}</span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-4">
                        <StatusBadge status={status} />
                      </td>

                      {/* Last Validated */}
                      <td className="px-5 py-4">
                        <span className="text-gray-500 font-mono text-xs">
                          {lic.last_validated ? new Date(lic.last_validated).toLocaleString() : '---'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status === 'active' && (
                            <button
                              onClick={() => setShowConfirm(lic.key)}
                              disabled={revoking === lic.key}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-md hover:bg-red-950/30 transition-all disabled:opacity-50"
                            >
                              {revoking === lic.key ? (
                                <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {revoking === lic.key ? 'REVOKING' : 'REVOKE'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-orange-500/20">
              <span className="text-xs text-gray-500 font-mono">
                {filtered.length} license{filtered.length !== 1 ? 's' : ''} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-md text-xs font-mono transition-all ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-orange-600/40 to-red-600/40 text-orange-300 border border-orange-500/30'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-orange-500/10'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setShowConfirm(null)}>
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-red-500/50 rounded-2xl p-6 w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-red-400/50"></div>
            <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-red-400/50"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-950/50 border-2 border-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">REVOKE LICENSE?</h3>
                <p className="text-gray-400 text-sm mt-1">This action cannot be undone.</p>
                <p className="text-red-400/80 font-mono text-xs mt-2 break-all">{showConfirm}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors font-mono text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => handleRevoke(showConfirm)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all font-mono text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  REVOKE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Form Modal */}
      {showForm && <GenerateForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load() }} />}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StatusBadge({ status }) {
  const config = {
    active: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      dot: 'bg-green-400',
      label: 'ACTIVE'
    },
    expired: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      dot: 'bg-yellow-400',
      label: 'EXPIRED'
    },
    revoked: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-400',
      label: 'REVOKED'
    }
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono ${c.bg} ${c.border} ${c.text} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'active' ? 'animate-pulse' : ''}`}></span>
      {c.label}
    </span>
  )
}

function GenerateForm({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [days, setDays] = useState(365)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const lic = await adminApi.createLicense({ name, days })
      setResult(lic)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyResult = async () => {
    try {
      await navigator.clipboard.writeText(result.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  const durationOptions = [
    { value: 7, label: '7 days', desc: 'Trial' },
    { value: 30, label: '30 days', desc: '1 month' },
    { value: 90, label: '90 days', desc: '3 months' },
    { value: 180, label: '180 days', desc: '6 months' },
    { value: 365, label: '365 days', desc: '1 year' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="relative bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-orange-500/40 rounded-2xl p-8 w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalIn 0.3s ease-out' }}
      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-orange-400/50"></div>
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-orange-400/50"></div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl"></div>

        {/* Scanline */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #ff6b00 2px, #ff6b00 4px)',
          animation: 'scanline 8s linear infinite'
        }}></div>

        <div className="relative z-10">
          {result ? (
            /* Success State */
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 mx-auto bg-green-950/50 border-2 border-green-500/30 rounded-full flex items-center justify-center" style={{ animation: 'scaleIn 0.5s ease-out' }}>
                <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 font-mono">LICENSE GENERATED</h2>
                <p className="text-gray-400 text-sm mt-1">Share this key with the user</p>
              </div>

              <div className="relative group">
                <div className="bg-black/50 border-2 border-green-500/30 rounded-xl p-4 font-mono text-center text-sm text-green-300 select-all break-all leading-relaxed">
                  {result.key}
                </div>
                <button
                  onClick={handleCopyResult}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-green-400/70" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-black/30 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-gray-500 font-mono text-xs mb-1">NAME</p>
                  <p className="text-white font-medium">{result.name}</p>
                </div>
                <div className="bg-black/30 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-gray-500 font-mono text-xs mb-1">EXPIRES</p>
                  <p className="text-white font-medium">{new Date(result.expires_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400/80 text-xs font-mono flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Copy this key now. It won't be shown in full again.
                </p>
              </div>

              <button
                onClick={onCreated}
                className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-lg transition-all font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(251,146,60,0.3)]"
              >
                DONE
              </button>
            </div>
          ) : (
            /* Form State */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 font-mono">GENERATE LICENSE</h2>
                  <p className="text-gray-500 text-sm mt-1">Create a new license key</p>
                </div>
                <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="block text-xs text-orange-300/80 mb-2 uppercase tracking-wider font-mono">&gt; User Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 bg-black/50 border-2 border-orange-500/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-400 focus:shadow-[0_0_20px_rgba(251,146,60,0.2)] transition-all font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-orange-300/80 mb-2 uppercase tracking-wider font-mono">&gt; Duration</label>
                <div className="grid grid-cols-5 gap-2">
                  {durationOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDays(opt.value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        days === opt.value
                          ? 'bg-gradient-to-b from-orange-600/30 to-red-600/30 border-orange-500/50 text-orange-300'
                          : 'bg-black/30 border-orange-500/20 text-gray-500 hover:text-gray-300 hover:border-orange-500/30'
                      }`}
                    >
                      <p className="font-mono text-xs font-bold">{opt.value}d</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-950/30 border-2 border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm font-mono">
                  <span className="text-red-400 font-bold mr-2">ERR</span>{error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-3 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors font-mono text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !name.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-gray-700 disabled:to-gray-800 text-white font-bold rounded-lg transition-all font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(251,146,60,0.3)] disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      GENERATING...
                    </>
                  ) : (
                    'GENERATE'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes scanline {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
        `}</style>
      </div>
    </div>
  )
}
