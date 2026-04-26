import { useState } from 'react'
import { adminApi } from '../lib/adminApi'

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await adminApi.login(username, password)
      adminApi.setToken(data.token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, #ff6b00 1px, transparent 1px),
            linear-gradient(to bottom, #ff6b00 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Glowing orbs - orange/red theme for admin */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-red-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Main card with glass effect */}
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl overflow-hidden">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-orange-400"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-red-400"></div>

          {/* Scanline effect */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #ff6b00 2px, #ff6b00 4px)',
            animation: 'scanline 8s linear infinite'
          }}></div>

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block relative mb-4">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 tracking-wider" style={{ fontFamily: 'Orbitron, monospace' }}>
                  XIXERO
                </h1>
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
              </div>
              <p className="text-orange-300/70 text-sm tracking-[0.3em] uppercase font-mono">Admin Control Panel</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-red-400/80 font-mono">RESTRICTED ACCESS</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs text-orange-300/80 mb-2 uppercase tracking-wider font-mono">
                  &gt; Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-4 py-3 bg-black/50 border-2 border-orange-500/30 rounded-lg text-orange-100 placeholder-orange-900/50 focus:outline-none focus:border-orange-400 focus:shadow-[0_0_20px_rgba(251,146,60,0.3)] transition-all duration-300 font-mono"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-orange-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-orange-300/80 mb-2 uppercase tracking-wider font-mono">
                  &gt; Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 bg-black/50 border-2 border-orange-500/30 rounded-lg text-orange-100 placeholder-orange-900/50 focus:outline-none focus:border-orange-400 focus:shadow-[0_0_20px_rgba(251,146,60,0.3)] transition-all duration-300 font-mono"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-orange-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className="relative bg-red-950/50 border-2 border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm font-mono overflow-hidden">
                  <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                  <div className="relative flex items-center gap-2">
                    <span className="text-red-400 font-bold">⚠</span>
                    {error}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-gray-700 disabled:to-gray-800 text-white font-bold rounded-lg transition-all duration-300 uppercase tracking-wider relative overflow-hidden group shadow-[0_0_30px_rgba(251,146,60,0.3)] disabled:shadow-none"
                style={{ fontFamily: 'Orbitron, monospace' }}
              >
                <span className="relative z-10">{loading ? 'AUTHENTICATING...' : 'SIGN IN'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
              </button>
            </form>

            {/* Footer decoration */}
            <div className="mt-8 pt-6 border-t border-orange-500/20">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-600 font-mono">
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
                  LICENSE MGMT
                </span>
                <span className="text-orange-500/30">|</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  USER MGMT
                </span>
                <span className="text-orange-500/30">|</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-pink-400 rounded-full"></div>
                  ANALYTICS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning badge */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-orange-400/60 font-mono">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>AUTHORIZED PERSONNEL ONLY</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  )
}
