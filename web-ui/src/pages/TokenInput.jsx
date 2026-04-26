import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function TokenInput() {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(token)
      navigate('/')
    } catch {
      setError('Invalid token. Check your terminal for the correct API token.')
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
            linear-gradient(to right, #00ffff 1px, transparent 1px),
            linear-gradient(to bottom, #00ffff 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Main card with glass effect */}
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-2xl overflow-hidden">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-cyan-400"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-purple-400"></div>

          {/* Scanline effect */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ffff 2px, #00ffff 4px)',
            animation: 'scanline 8s linear infinite'
          }}></div>

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block relative mb-4">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 tracking-wider" style={{ fontFamily: 'Orbitron, monospace' }}>
                  XIXERO
                </h1>
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
              </div>
              <p className="text-cyan-300/70 text-sm tracking-[0.3em] uppercase font-mono">Local AI Gateway</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400/80 font-mono">SYSTEM ONLINE</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs text-cyan-300/80 mb-2 uppercase tracking-wider font-mono">
                  &gt; API Token
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••"
                    className="w-full px-4 py-3 bg-black/50 border-2 border-cyan-500/30 rounded-lg text-cyan-100 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 font-mono"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-xs text-gray-500 mt-2 font-mono flex items-center gap-2">
                  <span className="text-cyan-400">$</span>
                  <span>Token available in terminal: <code className="text-cyan-400/80">xixero start</code></span>
                </p>
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
                disabled={loading || !token}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 text-white font-bold rounded-lg transition-all duration-300 uppercase tracking-wider relative overflow-hidden group shadow-[0_0_30px_rgba(34,211,238,0.3)] disabled:shadow-none"
                style={{ fontFamily: 'Orbitron, monospace' }}
              >
                <span className="relative z-10">{loading ? 'CONNECTING...' : 'CONNECT'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                {!loading && !token && (
                  <div className="absolute inset-0 bg-black/50"></div>
                )}
              </button>
            </form>

            {/* Footer decoration */}
            <div className="mt-8 pt-6 border-t border-cyan-500/20">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-600 font-mono">
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                  SECURE
                </span>
                <span className="text-cyan-500/30">|</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                  ENCRYPTED
                </span>
                <span className="text-cyan-500/30">|</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-pink-400 rounded-full"></div>
                  LOCAL
                </span>
              </div>
            </div>
          </div>
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
